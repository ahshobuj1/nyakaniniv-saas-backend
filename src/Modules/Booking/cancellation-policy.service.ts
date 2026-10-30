import { PrismaClient, BookingStatus, PaymentGateway, PaymentStatus, InvoiceStatus, TransactionStatus } from '@/prisma/generated/client';
import { AppLogger } from '@/core/logging/logger';
import { PaymentProviderResolver } from '../PaymentProvider/PaymentProviderResolver';
import { WalletService } from '../Wallet/wallet.service';
import { differenceInHours } from 'date-fns';
import {
  BookingRefundDetails,
  CancelledBy,
  GatewayRefundOutcome,
  RefundCalculation,
  RefundableBooking,
  RefundStatus,
} from './cancellation.types';

export type { RefundCalculation } from './cancellation.types';

/** Gateways whose money never passes through us, so refunds must be handled by hand. */
const MANUAL_REFUND_GATEWAYS: PaymentGateway[] = [PaymentGateway.CASH, PaymentGateway.MANUAL];

export class CancellationPolicyService {
  public static readonly MAX_REFUND_ATTEMPTS = 3;

  private logger = new AppLogger('CancellationPolicyService');

  constructor(
    private prisma: PrismaClient,
    private walletService: WalletService
  ) {}

  // ---------------------------------------------------------------------------
  // Policy calculation
  // ---------------------------------------------------------------------------

  public isBookingPaid(booking: RefundableBooking): boolean {
    return (
      booking.paymentStatus === PaymentStatus.PAID ||
      booking.paymentStatus === PaymentStatus.REFUND_PENDING ||
      booking.paymentStatus === PaymentStatus.PARTIALLY_REFUNDED ||
      booking.paymentStatus === PaymentStatus.REFUNDED ||
      booking.invoice?.status === InvoiceStatus.PAID
    );
  }

  public calculateRefund(booking: RefundableBooking, cancelledBy: CancelledBy): RefundCalculation {
    const totalAmount = Number(booking.totalAmount || 0);

    if (!this.isBookingPaid(booking)) {
      return {
        refundPercent: 0,
        refundAmount: 0,
        djCompensation: 0,
        reason: 'Booking was not paid yet, free cancellation with no charge.',
        policyTier: 'NO_REFUND',
      };
    }

    if (cancelledBy === 'DJ' || cancelledBy === 'SYSTEM') {
      return {
        refundPercent: 100,
        refundAmount: totalAmount,
        djCompensation: 0,
        reason: cancelledBy === 'DJ' ? 'DJ cancelled the booking (100% refund)' : 'System cancelled the booking (100% refund)',
        policyTier: 'FULL_REFUND',
      };
    }

    // Client initiated cancellation
    if (!booking.eventDate) {
      return {
        refundPercent: 100,
        refundAmount: totalAmount,
        djCompensation: 0,
        reason: 'Event date not set (100% refund)',
        policyTier: 'FULL_REFUND',
      };
    }

    const hoursUntilEvent = differenceInHours(new Date(booking.eventDate), new Date());

    if (hoursUntilEvent >= 72) {
      return {
        refundPercent: 100,
        refundAmount: totalAmount,
        djCompensation: 0,
        reason: 'Cancelled > 72h before event (100% full refund)',
        policyTier: 'FULL_REFUND',
      };
    }

    if (hoursUntilEvent >= 24) {
      const refundAmount = Math.round(totalAmount * 0.5 * 100) / 100;
      return {
        refundPercent: 50,
        refundAmount,
        djCompensation: Math.round((totalAmount - refundAmount) * 100) / 100,
        reason: 'Cancelled 24-72h before event (50% partial refund)',
        policyTier: 'PARTIAL_REFUND',
      };
    }

    return {
      refundPercent: 0,
      refundAmount: 0,
      djCompensation: totalAmount,
      reason: 'Cancelled < 24h before event (0% refund, artist compensated)',
      policyTier: 'NO_REFUND',
    };
  }

  // ---------------------------------------------------------------------------
  // Refund processing
  // ---------------------------------------------------------------------------

  /**
   * Settles a cancelled booking: reverses the DJ escrow, refunds the client through the
   * original gateway and records the outcome. Safe to call more than once.
   */
  public async processRefund(
    bookingId: string,
    cancelledBy: CancelledBy,
    cancellationReason?: string
  ): Promise<{ success: boolean; refundStatus: RefundStatus }> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: { tenant: true, invoice: true },
    });

    if (!booking) throw new Error('Booking not found');

    const existing = this.readDetails(booking.eventDetails);
    if (existing.refundProcessedAt && existing.refundStatus) {
      this.logger.info(`Refund for booking ${bookingId} already processed (${existing.refundStatus}). Skipping.`);
      return { success: true, refundStatus: existing.refundStatus };
    }

    const isPaid = this.isBookingPaid(booking);
    const refundCalc = this.calculateRefund(booking, cancelledBy);

    // Internal ledger first: idempotent and safe to repeat if anything below fails.
    if (isPaid) {
      await this.walletService.reverseBookingEscrow(bookingId, 100 - refundCalc.refundPercent);
    }

    // Persist intent *before* calling the gateway so a crash can never cause a double refund.
    const baseDetails: BookingRefundDetails = {
      cancelledBy,
      cancellationReason: cancellationReason || refundCalc.reason,
      refundPercent: refundCalc.refundPercent,
      refundAmount: refundCalc.refundAmount,
      refundProcessedAt: new Date().toISOString(),
    };

    let outcome: GatewayRefundOutcome = { status: isPaid ? 'NO_REFUND' : 'NONE' };

    if (isPaid && refundCalc.refundAmount > 0) {
      await this.saveDetails(bookingId, booking.eventDetails, {
        ...baseDetails,
        refundStatus: 'PROCESSING',
        refundAttempts: 1,
      });

      const transaction = await this.findRefundableTransaction(bookingId);
      outcome = await this.refundTransaction(
        transaction,
        refundCalc.refundAmount,
        transaction?.currency || booking.currencyCode || 'KES',
      );
    }

    await this.saveDetails(
      bookingId,
      booking.eventDetails,
      {
        ...baseDetails,
        refundStatus: outcome.status,
        refundFailureReason: outcome.failureReason,
        refundAttempts: outcome.status === 'NONE' || outcome.status === 'NO_REFUND' ? undefined : 1,
      },
      isPaid ? this.resolvePaymentStatus(refundCalc.refundPercent, refundCalc.refundAmount, outcome.status) : PaymentStatus.FAILED
    );

    return { success: true, refundStatus: outcome.status };
  }

  /**
   * A client can still finish a gateway checkout that was opened before the booking was
   * cancelled / expired / rejected. The money has been taken, so refund it in full.
   */
  public async refundLatePayment(bookingId: string, transactionId: string): Promise<{ refundStatus: RefundStatus }> {
    const booking = await this.prisma.booking.findUnique({ where: { id: bookingId } });
    const transaction = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!booking || !transaction) throw new Error('Booking or transaction not found for late payment refund');

    const amount = Number(transaction.amount);
    this.logger.warn(`Late payment of ${transaction.currency} ${amount} received for ${booking.status} booking ${bookingId}. Refunding in full.`);

    const baseDetails: BookingRefundDetails = {
      ...this.readDetails(booking.eventDetails),
      cancellationReason: `Payment received after the booking was ${booking.status.toLowerCase()} - refunded in full`,
      refundPercent: 100,
      refundAmount: amount,
      refundProcessedAt: new Date().toISOString(),
      lateRefund: true,
    };

    await this.saveDetails(bookingId, booking.eventDetails, { ...baseDetails, refundStatus: 'PROCESSING', refundAttempts: 1 });
    const outcome = await this.refundTransaction(transaction, amount, transaction.currency);

    await this.saveDetails(
      bookingId,
      booking.eventDetails,
      { ...baseDetails, refundStatus: outcome.status, refundFailureReason: outcome.failureReason, refundAttempts: 1 },
      this.resolvePaymentStatus(100, amount, outcome.status)
    );

    return { refundStatus: outcome.status };
  }

  /**
   * Re-attempts gateway refunds that previously FAILED. After MAX_REFUND_ATTEMPTS the refund
   * is escalated to MANUAL_REQUIRED so it never loops forever. Escrow is not touched again.
   */
  public async retryFailedRefunds(): Promise<number> {
    const failed = await this.prisma.booking.findMany({
      where: { eventDetails: { path: ['refundStatus'], equals: 'FAILED' } },
    });

    for (const booking of failed) {
      const details = this.readDetails(booking.eventDetails);
      const attempts = details.refundAttempts ?? 1;
      const amount = details.refundAmount ?? 0;
      const percent = details.refundPercent ?? 0;

      if (amount <= 0) continue;

      if (attempts >= CancellationPolicyService.MAX_REFUND_ATTEMPTS) {
        this.logger.error(`Refund for booking ${booking.id} failed ${attempts} times. Escalating to manual handling.`);
        await this.saveDetails(booking.id, booking.eventDetails, { ...details, refundStatus: 'MANUAL_REQUIRED' });
        continue;
      }

      const transaction = await this.findRefundableTransaction(booking.id);
      const outcome = await this.refundTransaction(
        transaction,
        amount,
        transaction?.currency || booking.currencyCode || 'KES',
      );

      await this.saveDetails(
        booking.id,
        booking.eventDetails,
        {
          ...details,
          refundStatus: outcome.status,
          refundFailureReason: outcome.failureReason,
          refundAttempts: attempts + 1,
        },
        this.resolvePaymentStatus(percent, amount, outcome.status)
      );
    }

    return failed.length;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private async findRefundableTransaction(bookingId: string) {
    return this.prisma.transaction.findFirst({
      where: { invoice: { bookingId }, status: { in: [TransactionStatus.SUCCEEDED, TransactionStatus.PARTIALLY_REFUNDED] } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Calls the original gateway and maps its answer to a RefundStatus. Never throws. */
  private async refundTransaction(
    transaction: Awaited<ReturnType<CancellationPolicyService['findRefundableTransaction']>>,
    amount: number,
    currency: string
  ): Promise<GatewayRefundOutcome> {
    if (!transaction || !transaction.gatewayReference || !transaction.gateway) {
      this.logger.warn('No gateway transaction found to refund - manual handling required.');
      return { status: 'MANUAL_REQUIRED', failureReason: 'No gateway transaction found for this booking' };
    }

    if (MANUAL_REFUND_GATEWAYS.includes(transaction.gateway)) {
      return { status: 'MANUAL_REQUIRED', failureReason: `${transaction.gateway} payments must be refunded manually` };
    }

    try {
      const provider = PaymentProviderResolver.getGatewayProvider(transaction.gateway);
      if (!provider.refundPayment) {
        return { status: 'MANUAL_REQUIRED', failureReason: `${transaction.gateway} does not support automated refunds` };
      }

      const result = await provider.refundPayment(transaction.gatewayReference, amount, currency);

      if (result.outcome === 'COMPLETED') {
        await this.recordRefundOnTransaction(transaction.id, Number(transaction.amount), Number(transaction.refundedAmount || 0), amount);
        return { status: 'COMPLETED' };
      }
      if (result.outcome === 'PENDING') {
        return { status: 'PROCESSING' };
      }
      return { status: 'FAILED', failureReason: result.failureReason || 'Gateway rejected the refund' };
    } catch (error: any) {
      this.logger.error('Unexpected error while calling gateway refund:', error);
      return { status: 'FAILED', failureReason: error?.message || 'Unexpected refund error' };
    }
  }

  private async recordRefundOnTransaction(transactionId: string, total: number, alreadyRefunded: number, refunded: number) {
    const totalRefunded = Math.round((alreadyRefunded + refunded) * 100) / 100;
    const remaining = Math.max(0, Math.round((total - totalRefunded) * 100) / 100);

    await this.prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: remaining === 0 ? TransactionStatus.REFUNDED : TransactionStatus.PARTIALLY_REFUNDED,
        refundedAmount: totalRefunded,
        remainingAmount: remaining,
      },
    });
  }

  private resolvePaymentStatus(refundPercent: number, refundAmount: number, status: RefundStatus): PaymentStatus {
    if (refundAmount <= 0) return PaymentStatus.PAID;
    if (status === 'COMPLETED') {
      return refundPercent >= 100 ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED;
    }
    return PaymentStatus.REFUND_PENDING;
  }

  private readDetails(raw: unknown): BookingRefundDetails & Record<string, unknown> {
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) return { ...(raw as Record<string, unknown>) };
    if (typeof raw === 'string') return { notes: raw };
    return {};
  }

  /** Merges refund fields into the existing eventDetails JSON (dropping undefined values). */
  private async saveDetails(
    bookingId: string,
    currentDetails: unknown,
    patch: BookingRefundDetails,
    paymentStatus?: PaymentStatus
  ) {
    const merged = { ...this.readDetails(currentDetails), ...patch } as Record<string, unknown>;
    Object.keys(merged).forEach((key) => merged[key] === undefined && delete merged[key]);

    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        eventDetails: merged as any,
        ...(paymentStatus ? { paymentStatus } : {}),
      },
    });
  }
}
