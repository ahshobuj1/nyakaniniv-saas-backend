import {
  PrismaClient,
  BookingStatus,
  PaymentStatus,
  InvoiceStatus,
  TransactionStatus,
  Prisma,
} from '@/prisma/generated/client';
import { BadRequestError, NotFoundError } from '@/core/errors/AppError';
import { AppLogger } from '@/core/logging/logger';
import { IEmailProvider } from '@/providers/EmailProvider';
import { EmailTemplates } from '@/utils/EmailTemplates';
import { config } from '@/core/config';
import { generateBookingAccessToken } from '@/utils/jwt';

export interface TransitionBookingInput {
  bookingId: string;
  targetStatus: BookingStatus;
  userId?: string;
  reason?: string;
  totalAmount?: number;
  currencyCode?: string;
  cancelledBy?: 'CLIENT' | 'DJ' | 'SYSTEM';
}

export class BookingStatusService {
  private logger = new AppLogger('BookingStatusService');

  // Strict valid transition map for Direct Payment workflow
  private static readonly VALID_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
    [BookingStatus.PENDING]: [
      BookingStatus.ACCEPTED,
      BookingStatus.AWAITING_PAYMENT,
      BookingStatus.REJECTED,
      BookingStatus.CANCELLED,
      BookingStatus.EXPIRED,
    ],
    [BookingStatus.ACCEPTED]: [
      BookingStatus.CONFIRMED,
      BookingStatus.REJECTED,
      BookingStatus.CANCELLED,
    ],
    [BookingStatus.AWAITING_PAYMENT]: [
      BookingStatus.ACCEPTED,
      BookingStatus.CONFIRMED,
      BookingStatus.REJECTED,
      BookingStatus.CANCELLED,
      BookingStatus.EXPIRED,
    ],
    [BookingStatus.CONFIRMED]: [
      BookingStatus.IN_PROGRESS,
      BookingStatus.COMPLETED,
      BookingStatus.CANCELLED,
      BookingStatus.DISPUTED,
    ],
    [BookingStatus.IN_PROGRESS]: [
      BookingStatus.COMPLETED,
      BookingStatus.CANCELLED,
      BookingStatus.DISPUTED,
      BookingStatus.NO_SHOW,
    ],
    [BookingStatus.COMPLETED]: [
      BookingStatus.DISPUTED,
    ],
    [BookingStatus.NO_SHOW]: [
      BookingStatus.DISPUTED,
    ],
    [BookingStatus.DISPUTED]: [
      BookingStatus.COMPLETED,
      BookingStatus.CONFIRMED,
      BookingStatus.CANCELLED,
    ],
    [BookingStatus.REJECTED]: [],
    [BookingStatus.CANCELLED]: [],
    [BookingStatus.EXPIRED]: [],
  };

  constructor(
    private prisma: PrismaClient,
    private emailProvider: IEmailProvider
  ) {}

  public isValidTransition(current: BookingStatus, target: BookingStatus): boolean {
    const allowed = BookingStatusService.VALID_TRANSITIONS[current] || [];
    return allowed.includes(target);
  }

  public async transition(input: TransitionBookingInput) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: input.bookingId },
      include: {
        client: true,
        tenant: { include: { user: true } },
      },
    });

    if (!booking) {
      throw new NotFoundError(`Booking #${input.bookingId} not found`);
    }

    const currentStatus = booking.status;
    const targetStatus = input.targetStatus;

    if (currentStatus === targetStatus) {
      return booking;
    }

    if (!this.isValidTransition(currentStatus, targetStatus)) {
      throw new BadRequestError(
        `Invalid booking status transition: cannot change status from ${currentStatus} to ${targetStatus}`
      );
    }

    this.logger.info(`Transitioning booking #${booking.id} from ${currentStatus} to ${targetStatus}`);

    // State machine updates based on target status
    const updatedBooking = await this.prisma.$transaction(async (tx) => {
      const updateData: any = {
        status: targetStatus,
      };

      // 1. Moving to ACCEPTED (DJ accepted booking and provided initial quote)
      if (targetStatus === BookingStatus.ACCEPTED || targetStatus === BookingStatus.AWAITING_PAYMENT) {
        const amount = input.totalAmount ?? Number(booking.totalAmount);
        const currency =
          input.currencyCode ||
          booking.currencyCode ||
          booking.tenant?.currencyCode ||
          'USD';

        if (amount > 0) {
          updateData.totalAmount = amount;
          updateData.currencyCode = currency;

          // Create initial BookingQuote if none exists yet
          const existingQuote = await tx.bookingQuote.findFirst({
            where: { bookingId: booking.id },
          });

          if (!existingQuote) {
            await tx.bookingQuote.create({
              data: {
                bookingId: booking.id,
                version: 1,
                amount,
                currency,
                proposedBy: 'DJ',
                status: 'PROPOSED',
                notes: 'Initial quotation from DJ upon accepting request',
              },
            });
          }
        }
      }

      // 2. Moving to CONFIRMED (Price agreed and date locked)
      if (targetStatus === BookingStatus.CONFIRMED) {
        updateData.confirmedAt = new Date();
      }

      // 3. Moving to COMPLETED (Event ended)
      if (targetStatus === BookingStatus.COMPLETED) {
        if (booking.eventDate && new Date(booking.eventDate).getTime() > Date.now()) {
          const dateStr = new Date(booking.eventDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });
          throw new BadRequestError(
            `Cannot mark booking as completed before its scheduled date (${dateStr}). The event has not taken place yet.`
          );
        }
        updateData.completedAt = new Date();
      }

      // 4. Moving to CANCELLED
      if (targetStatus === BookingStatus.CANCELLED) {
        updateData.cancelledAt = new Date();
        const cancelledBy = input.cancelledBy || 'DJ';

        let updatedDetails: any = {};
        if (typeof booking.eventDetails === 'object' && booking.eventDetails !== null) {
          updatedDetails = { ...booking.eventDetails };
        } else if (typeof booking.eventDetails === 'string') {
          updatedDetails = { notes: booking.eventDetails };
        }
        updatedDetails.cancelledBy = cancelledBy;
        updatedDetails.cancellationReason = input.reason || 'Cancelled';
        updateData.eventDetails = updatedDetails;
      }

      // 5. Moving to REJECTED (DJ declines booking request)
      if (targetStatus === BookingStatus.REJECTED) {
        if (!input.reason || !input.reason.trim()) {
          throw new BadRequestError('A reason or note must be provided when declining a booking request.');
        }
        let updatedDetails: any = {};
        if (typeof booking.eventDetails === 'object' && booking.eventDetails !== null) {
          updatedDetails = { ...booking.eventDetails };
        } else if (typeof booking.eventDetails === 'string') {
          updatedDetails = { notes: booking.eventDetails };
        }
        updatedDetails.declineReason = input.reason.trim();
        updateData.eventDetails = updatedDetails;
      }

      const res = await tx.booking.update({
        where: { id: booking.id },
        data: updateData,
        include: { client: true, tenant: { include: { user: true } } },
      });

      // Record in BookingAuditEvent
      await tx.bookingAuditEvent.create({
        data: {
          bookingId: booking.id,
          actorType: input.cancelledBy || (input.userId ? 'DJ' : 'SYSTEM'),
          actorId: input.userId || null,
          eventType: `STATUS_CHANGED_TO_${targetStatus}`,
          metadata: {
            fromStatus: currentStatus,
            toStatus: targetStatus,
            reason: input.reason,
            totalAmount: input.totalAmount,
            currencyCode: input.currencyCode,
          },
        },
      });

      return res;
    });

    // Side-effects outside of DB transaction (Email notifications)
    await this.handlePostTransitionSideEffects(booking, updatedBooking, targetStatus, input.reason, input.cancelledBy);

    return updatedBooking;
  }

  private async handlePostTransitionSideEffects(
    previous: any,
    updated: any,
    targetStatus: BookingStatus,
    reason?: string,
    cancelledByParam?: string
  ) {
    const djName = updated.tenant?.stageName || updated.tenant?.user?.firstName || 'DJ';
    const clientEmail = updated.client?.email;
    const clientName = updated.client?.name || 'Client';
    const eventName = updated.eventType || 'Event';
    const amount = Number(updated.totalAmount || 0);
    const currency =
      updated.currencyCode || updated.tenant?.currencyCode || 'USD';
    const orderReference = updated.orderReference || `UB-${updated.id.slice(0, 8).toUpperCase()}`;
    const targetTz = updated.eventTimezone || updated.tenant?.timezone || 'Africa/Nairobi';

    let eventDate = '';
    if (updated.eventDate) {
      eventDate = EmailTemplates.formatEventDateTimeWithZone(updated.eventDate, targetTz);
    }

    const clientAccessToken = clientEmail
      ? generateBookingAccessToken({
          bookingId: updated.id,
          orderReference,
          clientEmail,
          role: 'CLIENT',
        })
      : null;

    const portalUrl = clientAccessToken
      ? `${config.clientUrl}/booking/manage/${updated.id}?ref=${encodeURIComponent(orderReference)}&token=${encodeURIComponent(clientAccessToken)}`
      : `${config.clientUrl}/booking/manage/${updated.id}?ref=${encodeURIComponent(orderReference)}`;
    const dashboardUrl = `${config.clientUrl}/dashboard/bookings/${updated.id}`;

    // ACCEPTED: Notify client with quote and secure booking page access instructions
    if ((targetStatus === BookingStatus.ACCEPTED || targetStatus === BookingStatus.AWAITING_PAYMENT) && clientEmail) {
      this.emailProvider.sendEmail(
        clientEmail,
        `Booking Accepted by ${djName} - Initial Quote Ready (Ref: ${orderReference})`,
        EmailTemplates.getBookingAcceptedWithQuoteTemplate({
          clientName,
          djName,
          eventType: eventName,
          eventDate,
          currency,
          amount,
          orderReference,
          portalUrl,
        })
      );
    }

    // CONFIRMED: Notify client and DJ that agreement is reached and date locked
    if (targetStatus === BookingStatus.CONFIRMED) {
      if (clientEmail) {
        const clientContent = `
          <p style="margin-top: 0; font-size: 16px;">Hi <strong>${clientName}</strong>,</p>
          <p style="font-size: 15px; line-height: 1.6;">
            Your booking for <strong>${eventName}</strong> with <strong>${djName}</strong> on <strong>${eventDate}</strong> is officially <strong>confirmed</strong>!
          </p>
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px;"><strong>Booking Reference:</strong> <code>${orderReference}</code></p>
            <p style="margin: 6px 0 0 0; font-size: 14px;"><strong>Agreed Performance Fee:</strong> <strong>${currency} ${amount.toLocaleString()}</strong></p>
            <p style="margin: 6px 0 0 0; font-size: 13px; color: #64748b;">Payment terms are handled directly between you and the artist as agreed.</p>
          </div>
          <div style="text-align: center; margin: 28px 0 16px 0;">
            <a href="${portalUrl}" style="display: inline-block; padding: 14px 28px; background-color: #0f172a; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 15px;">
              View Your Booking Details &rarr;
            </a>
          </div>
        `;
        this.emailProvider.sendEmail(
          clientEmail,
          `Booking Confirmed with ${djName} (Ref: ${orderReference})`,
          EmailTemplates.getHtmlShell('Booking Confirmed', clientContent)
        );
      }

      if (updated.tenant?.user?.email) {
        const djContent = `
          <p style="margin-top: 0; font-size: 16px;">Hi <strong>${djName}</strong>,</p>
          <p style="font-size: 15px; line-height: 1.6;">
            Booking <code>${orderReference}</code> for <strong>${eventName}</strong> with <strong>${clientName}</strong> on <strong>${eventDate}</strong> is now confirmed!
          </p>
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px;"><strong>Agreed Fee:</strong> ${currency} ${amount.toLocaleString()}</p>
            <p style="margin: 6px 0 0 0; font-size: 13px; color: #64748b;">Payment arrangements are handled directly between you and the client.</p>
          </div>
          <div style="text-align: center; margin: 28px 0 16px 0;">
            <a href="${dashboardUrl}" style="display: inline-block; padding: 14px 28px; background-color: #0f172a; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 15px;">
              View Booking in Dashboard &rarr;
            </a>
          </div>
        `;
        this.emailProvider.sendEmail(
          updated.tenant.user.email,
          `Booking Confirmed! ${eventName} on ${eventDate}`,
          EmailTemplates.getHtmlShell('Booking Confirmed', djContent)
        );
      }
    }

    // COMPLETED: Invite client to leave rating and review
    if (targetStatus === BookingStatus.COMPLETED && clientEmail) {
      this.emailProvider.sendEmail(
        clientEmail,
        `How was your event with ${djName}? - UpBeat Entertainment Africa`,
        EmailTemplates.getReviewRequestTemplate({
          clientName,
          djName,
          portalUrl,
        })
      );
    }

    // REJECTED: Send DJ decline notification
    if (targetStatus === BookingStatus.REJECTED && clientEmail) {
      this.emailProvider.sendEmail(
        clientEmail,
        `Booking Declined: ${eventName} - UpBeat Entertainment Africa`,
        EmailTemplates.getBookingRejectedTemplate(djName, eventName, reason, config.clientUrl, portalUrl)
      );
    }

    // CANCELLED: Send cancellation notification
    if (targetStatus === BookingStatus.CANCELLED) {
      const details = (updated.eventDetails as any) || {};
      const cancelledBy = cancelledByParam || details.cancelledBy || 'DJ';

      if (clientEmail) {
        this.emailProvider.sendEmail(
          clientEmail,
          `Booking Cancelled: ${eventName} - UpBeat Entertainment Africa`,
          EmailTemplates.getBookingCancelledTemplate({
            recipientName: clientName,
            cancelledBy: cancelledBy as any,
            djName,
            eventType: eventName,
            reason,
            manageUrl: portalUrl,
          })
        );
      }

      if (cancelledBy !== 'DJ' && updated.tenant?.user?.email) {
        this.emailProvider.sendEmail(
          updated.tenant.user.email,
          `Booking Cancelled: ${eventName} - UpBeat Entertainment Africa`,
          EmailTemplates.getBookingCancelledTemplate({
            recipientName: djName,
            cancelledBy: 'CLIENT',
            djName,
            eventType: eventName,
            reason,
            manageUrl: dashboardUrl,
          })
        );
      }
    }
  }
}
