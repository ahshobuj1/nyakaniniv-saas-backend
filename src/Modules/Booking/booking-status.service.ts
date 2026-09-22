import {
  PrismaClient,
  BookingStatus,
  PaymentStatus,
  InvoiceStatus,
  InvoiceType,
  NotificationType,
  TransactionStatus,
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
        if (booking.paymentStatus === PaymentStatus.PAID) {
          updateData.paymentStatus = PaymentStatus.REFUND_PENDING;
        }
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
    await this.handlePostTransitionSideEffects(booking, updatedBooking, targetStatus, input.reason);

    return updatedBooking;
  }

  private async handlePostTransitionSideEffects(previous: any, updated: any, targetStatus: BookingStatus, reason?: string) {
    const djName = updated.tenant?.stageName || updated.tenant?.user?.firstName || 'DJ';
    const clientEmail = updated.client?.email;
    const clientName = updated.client?.name || 'Client';
    const eventName = updated.eventType || 'Event';
    const amount = Number(updated.totalAmount || 0);
    const currency = updated.currencyCode || 'KES';
    const eventDate = updated.eventDate
      ? new Date(updated.eventDate).toLocaleDateString('en-US', {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : '';

    let eventTime = '';
    if (updated.eventDate) {
      const d = new Date(updated.eventDate);
      if (!isNaN(d.getTime())) {
        const hours = d.getUTCHours();
        const minutes = d.getUTCMinutes();
        if (hours !== 0 || minutes !== 0) {
          eventTime = d.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });
        }
      }
    }

    if (updated.eventDetails) {
      let rawText = '';
      if (typeof updated.eventDetails === 'object' && updated.eventDetails !== null) {
        if (updated.eventDetails.startTime) eventTime = String(updated.eventDetails.startTime);
        else if (updated.eventDetails.time) eventTime = String(updated.eventDetails.time);
        else if (updated.eventDetails.notes) rawText = String(updated.eventDetails.notes);
      } else if (typeof updated.eventDetails === 'string') {
        rawText = updated.eventDetails;
      }
      if (!eventTime && rawText) {
        const match = rawText.match(/Start Time:\s*([^\n\r]+)/i);
        if (match && match[1]) {
          eventTime = match[1].trim();
        }
      }
    }

    if (updated.eventTimezone && eventTime && !eventTime.includes(updated.eventTimezone)) {
      eventTime = `${eventTime} (${updated.eventTimezone})`;
    }

    const venue = updated.address || '';

    // AWAITING_PAYMENT: send customer email with direct checkout link
    if (targetStatus === BookingStatus.AWAITING_PAYMENT && clientEmail) {
      const checkoutUrl = `${config.clientUrl}/checkout/${updated.id}`;
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
        })
      );
    }

    // CONFIRMED: notify both client and DJ
    if (targetStatus === BookingStatus.CONFIRMED) {
      if (clientEmail) {
        this.emailProvider.sendEmail(
          clientEmail,
          `Booking Confirmed! Payment Received - UpBeat Entertainment Africa`,
          `<div style="font-family: sans-serif; padding: 20px;">
            <h2>Your Booking is Confirmed!</h2>
            <p>Hi ${updated.client?.name || 'there'},</p>
            <p>Your payment for <strong>${eventName}</strong> with <strong>${djName}</strong> on <strong>${updated.eventDate ? new Date(updated.eventDate).toLocaleDateString() : 'your event date'}</strong> has been verified.</p>
            <p>Thank you for booking through UpBeat Entertainment Africa!</p>
          </div>`
        );
      }

      if (updated.tenant?.user?.email) {
        this.emailProvider.sendEmail(
          updated.tenant.user.email,
          `Payment Received! Booking #${updated.id.substring(0, 8)} Confirmed`,
          `<div style="font-family: sans-serif; padding: 20px;">
            <h2>Payment Confirmed!</h2>
            <p>Great news! The client <strong>${updated.client?.name}</strong> has successfully completed payment for <strong>${eventName}</strong>.</p>
            <p>Funds are secured in your UpBeat Pending Escrow Wallet and will be released to your Available Balance upon event completion.</p>
          </div>`
        );
      }
    }

    // COMPLETED: automatically release escrow funds from Pending -> Available
    if (targetStatus === BookingStatus.COMPLETED) {
      try {
        const { WalletService } = await import('@/Modules/Wallet/wallet.service');
        const walletService = new WalletService(this.prisma);
        await walletService.releaseBookingEscrow(updated.id);
      } catch (err: any) {
        this.logger.error(`Failed to release escrow for booking ${updated.id}:`, err);
      }
    }

    // CANCELLED or REJECTED: send rejection/cancellation notification
    if ((targetStatus === BookingStatus.CANCELLED || targetStatus === BookingStatus.REJECTED) && clientEmail) {
      this.emailProvider.sendEmail(
        clientEmail,
        `Booking Declined: ${eventName} - UpBeat Entertainment Africa`,
        EmailTemplates.getBookingRejectedTemplate(djName, eventName, reason, config.clientUrl)
      );
    }
  }
}
