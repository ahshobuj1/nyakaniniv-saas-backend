import {
  PrismaClient,
  BookingStatus,
  PaymentStatus,
  InvoiceStatus,
  InvoiceType,
  NotificationType,
  TransactionStatus,
  Prisma,
} from '@/prisma/generated/client';
import { BadRequestError, NotFoundError } from '@/core/errors/AppError';
import { AppLogger } from '@/core/logging/logger';
import { IEmailProvider } from '@/providers/EmailProvider';
import { EmailTemplates } from '@/utils/EmailTemplates';
import { config } from '@/core/config';

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

  // Strict valid transition map from specification
  private static readonly VALID_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
    [BookingStatus.PENDING]: [
      BookingStatus.AWAITING_PAYMENT,
      BookingStatus.REJECTED,
      BookingStatus.CANCELLED,
      BookingStatus.EXPIRED,
    ],
    [BookingStatus.AWAITING_PAYMENT]: [
      BookingStatus.CONFIRMED,
      BookingStatus.REJECTED,
      BookingStatus.CANCELLED,
      BookingStatus.EXPIRED,
    ],
    [BookingStatus.CONFIRMED]: [
      BookingStatus.IN_PROGRESS,
      BookingStatus.COMPLETED,
      BookingStatus.CANCELLED,
    ],
    [BookingStatus.IN_PROGRESS]: [
      BookingStatus.COMPLETED,
      BookingStatus.CANCELLED,
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

  /** Voids the unpaid invoice and any in-flight checkout attempts of a booking. */
  private async voidUnpaidInvoice(
    tx: Prisma.TransactionClient,
    booking: { id: string; invoice?: { id: string } | null },
    transactionStatus: TransactionStatus = TransactionStatus.CANCELLED
  ) {
    await tx.invoice.updateMany({
      where: { bookingId: booking.id, status: InvoiceStatus.UNPAID },
      data: { status: InvoiceStatus.OVERDUE },
    });

    if (booking.invoice?.id) {
      await tx.transaction.updateMany({
        where: { invoiceId: booking.invoice.id, status: TransactionStatus.PENDING },
        data: { status: transactionStatus },
      });
    }
  }

  public async transition(input: TransitionBookingInput) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: input.bookingId },
      include: {
        client: true,
        invoice: true,
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

    // State machine side effects based on target status
    let updatedBooking = await this.prisma.$transaction(async (tx) => {
      const updateData: any = {
        status: targetStatus,
      };

      // 1. Moving to AWAITING_PAYMENT (DJ accepted request and set price)
      if (targetStatus === BookingStatus.AWAITING_PAYMENT) {
        
        // Payout Account Validation
        const payoutAccount = await tx.tenantPaymentAccount.findFirst({
          where: { tenantId: booking.tenantId!, isActive: true },
        });
        
        if (!payoutAccount) {
          throw new BadRequestError('You must connect a payout account in your wallet before accepting bookings.');
        }

        if (!input.totalAmount && Number(booking.totalAmount) <= 0) {
          throw new BadRequestError('Total amount must be specified when accepting a booking.');
        }

        const amount = input.totalAmount ? input.totalAmount : Number(booking.totalAmount);
        const currency = input.currencyCode || booking.currencyCode || 'KES';

        updateData.totalAmount = amount;
        updateData.currencyCode = currency;
        updateData.paymentStatus = PaymentStatus.PENDING;
        // 48 hour payment due window
        updateData.paymentDueAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

        // Upsert Invoice
        await tx.invoice.upsert({
          where: { bookingId: booking.id },
          update: {
            amount,
            currencyCode: currency,
            status: InvoiceStatus.UNPAID,
            dueDate: updateData.paymentDueAt,
          },
          create: {
            tenantId: booking.tenantId,
            bookingId: booking.id,
            amount,
            currencyCode: currency,
            status: InvoiceStatus.UNPAID,
            type: InvoiceType.BOOKING,
            dueDate: updateData.paymentDueAt,
          },
        });
      }

      // 2. Moving to CONFIRMED (Verified Payment received)
      if (targetStatus === BookingStatus.CONFIRMED) {
        updateData.confirmedAt = new Date();
        updateData.paymentStatus = PaymentStatus.PAID;
      }

      // 3. Moving to COMPLETED (Event ended)
      if (targetStatus === BookingStatus.COMPLETED) {
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

        if (booking.paymentStatus === PaymentStatus.PAID) {
          updateData.paymentStatus = PaymentStatus.REFUND_PENDING;
        } else if (booking.invoice?.status !== InvoiceStatus.PAID) {
          // Unpaid booking: void the invoice and any in-flight checkout attempts
          await this.voidUnpaidInvoice(tx, booking);
        }
      }

      // 4b. Moving to EXPIRED (payment window elapsed)
      if (targetStatus === BookingStatus.EXPIRED) {
        updateData.paymentStatus = PaymentStatus.FAILED;
        await this.voidUnpaidInvoice(tx, booking);
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
        updateData.paymentStatus = PaymentStatus.FAILED;

        // Invalidate unpaid invoice and cancel any pending transactions
        await tx.invoice.updateMany({
          where: { bookingId: booking.id, status: InvoiceStatus.UNPAID },
          data: { status: InvoiceStatus.OVERDUE },
        });

        const invoiceId = booking.invoice?.id;
        if (invoiceId) {
          await tx.transaction.updateMany({
            where: { invoiceId, status: TransactionStatus.PENDING },
            data: { status: TransactionStatus.FAILED },
          });
        }
      }

      const res = await tx.booking.update({
        where: { id: booking.id },
        data: updateData,
        include: { client: true, invoice: true, tenant: { include: { user: true } } },
      });

      // Audit log entry
      await tx.auditLog.create({
        data: {
          userId: input.userId || booking.tenant?.userId || null,
          action: 'BOOKING_STATUS_TRANSITION',
          metadata: {
            bookingId: booking.id,
            fromStatus: currentStatus,
            toStatus: targetStatus,
            reason: input.reason,
            timestamp: new Date().toISOString(),
          },
        },
      });

      return res;
    });

    // Side-effects outside of DB transaction (Escrow release & emails)
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
    const currency = updated.currencyCode || 'KES';
    const targetTz = updated.eventTimezone || updated.tenant?.timezone || 'Africa/Nairobi';

    let eventDate = '';
    let eventTime = '';

    if (updated.eventDate) {
      const d = new Date(updated.eventDate);
      if (!isNaN(d.getTime())) {
        try {
          eventDate = d.toLocaleDateString('en-US', {
            timeZone: targetTz,
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });
          const timeFormatted = d.toLocaleTimeString('en-US', {
            timeZone: targetTz,
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });
          eventTime = timeFormatted;
        } catch {
          eventDate = d.toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });
          eventTime = d.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });
        }
      }
    }

    const venue = updated.address || '';

    // AWAITING_PAYMENT: send customer email with direct checkout link and manage link
    if (targetStatus === BookingStatus.AWAITING_PAYMENT && clientEmail) {
      const checkoutUrl = `${config.clientUrl}/checkout/${updated.id}`;
      const manageUrl = `${config.clientUrl}/booking/manage/${updated.id}`;
      const checkoutRedirectUrl = `${config.apiUrl}/bookings/v1/${updated.id}/checkout-redirect`;

      const amountFormatted = amount > 0 ? ` (${currency} ${amount.toLocaleString()})` : '';
      const emailSubject = `Booking Accepted by ${djName}! Complete Payment${amountFormatted} to Lock Your Date - UpBeat Entertainment Africa`;

      this.emailProvider.sendEmail(
        clientEmail,
        emailSubject,
        EmailTemplates.getBookingAcceptedTemplate({
          clientName,
          djName,
          eventType: eventName,
          eventDate,
          eventTime,
          venue,
          currency,
          amount,
          paymentUrl: checkoutUrl || checkoutRedirectUrl,
          manageUrl,
        })
      );
    }

    // CONFIRMED: notify both client and DJ
    if (targetStatus === BookingStatus.CONFIRMED) {
      const manageUrl = `${config.clientUrl}/booking/manage/${updated.id}`;
      const dashboardUrl = `${config.clientUrl}/dashboard/bookings/${updated.id}`;
      const eventDateDisplay = updated.eventDate ? new Date(updated.eventDate).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : 'your event date';

      if (clientEmail) {
        const clientContent = `
          <p style="margin-top: 0; font-size: 16px;">Hi <strong>${updated.client?.name || 'there'}</strong>,</p>
          <p style="font-size: 15px; line-height: 1.6;">
            Your payment for <strong>${eventName}</strong> with <strong>${djName}</strong> on <strong>${eventDateDisplay}</strong> has been successfully verified and secured in UpBeat Escrow.
          </p>
          <p style="font-size: 14px; color: #475569; line-height: 1.6;">
            Your date is 100% locked on ${djName}&apos;s schedule. You can access your artist contact details, schedule, and cancellation policy at any time through your booking portal:
          </p>
          <div style="text-align: center; margin: 28px 0 20px 0;">
            <a href="${manageUrl}" style="display: inline-block; padding: 14px 28px; background-color: #0f172a; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: 700; font-size: 15px;">
              View / Manage Your Booking &rarr;
            </a>
          </div>
        `;
        this.emailProvider.sendEmail(
          clientEmail,
          `Booking Confirmed! Payment Received - UpBeat Entertainment Africa`,
          EmailTemplates.getHtmlShell('Booking Confirmed', clientContent)
        );
      }

      if (updated.tenant?.user?.email) {
        const djContent = `
          <p style="margin-top: 0; font-size: 16px;">Great news, <strong>${djName}</strong>!</p>
          <p style="font-size: 15px; line-height: 1.6;">
            The client <strong>${updated.client?.name || 'Client'}</strong> has successfully completed payment for <strong>${eventName}</strong> on <strong>${eventDateDisplay}</strong>.
          </p>
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #166534; line-height: 1.6;">
              <strong>Escrow Protection:</strong> Funds are secured in your UpBeat Pending Escrow Wallet and will be released to your Available Balance immediately upon completing the event.
            </p>
          </div>
          <div style="text-align: center; margin: 28px 0 20px 0;">
            <a href="${dashboardUrl}" style="display: inline-block; padding: 14px 28px; background-color: #0f172a; color: #ffffff; text-decoration: none; border-radius: 4px; font-weight: 700; font-size: 15px;">
              View Booking in Dashboard &rarr;
            </a>
          </div>
        `;
        this.emailProvider.sendEmail(
          updated.tenant.user.email,
          `Payment Received! Booking #${updated.id.substring(0, 8)} Confirmed`,
          EmailTemplates.getHtmlShell('Payment Confirmed', djContent)
        );
      }
    }

    // COMPLETED: automatically release escrow funds from Pending -> Available
    if (targetStatus === BookingStatus.COMPLETED) {
      try {
        const { WalletService } = require('@/Modules/Wallet/wallet.service');
        const walletService = new WalletService(this.prisma);
        await walletService.releaseBookingEscrow(updated.id);
      } catch (err: any) {
        this.logger.error(`Failed to release escrow for booking ${updated.id}:`, err);
      }
    }

    // REJECTED: send DJ decline notification
    if (targetStatus === BookingStatus.REJECTED && clientEmail) {
      const manageUrl = `${config.clientUrl}/booking/manage/${updated.id}`;
      this.emailProvider.sendEmail(
        clientEmail,
        `Booking Declined: ${eventName} - UpBeat Entertainment Africa`,
        EmailTemplates.getBookingRejectedTemplate(djName, eventName, reason, config.clientUrl, manageUrl)
      );
    }

    // CANCELLED: send cancellation notification to client & DJ
    if (targetStatus === BookingStatus.CANCELLED) {
      const details = (updated.eventDetails as any) || {};
      const cancelledBy = cancelledByParam || details.cancelledBy || 'DJ';
      const manageUrl = `${config.clientUrl}/booking/manage/${updated.id}`;

      if (clientEmail) {
        this.emailProvider.sendEmail(
          clientEmail,
          `Booking Cancelled: ${eventName} - UpBeat Entertainment Africa`,
          EmailTemplates.getBookingCancelledTemplate({
            recipientName: updated.client?.name || 'there',
            cancelledBy: cancelledBy as any,
            djName,
            eventType: eventName,
            reason,
            manageUrl,
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
            manageUrl,
          })
        );
      }

      try {
        const { WalletService } = require('@/Modules/Wallet/wallet.service');
        const { CancellationPolicyService } = require('./cancellation-policy.service');
        const walletService = new WalletService(this.prisma);
        const policyService = new CancellationPolicyService(this.prisma, walletService);
        await policyService.processRefund(updated.id, cancelledBy, reason);
      } catch (err: any) {
        this.logger.error(`Failed to process refund for booking ${updated.id}:`, err);
      }
    }
  }
}
