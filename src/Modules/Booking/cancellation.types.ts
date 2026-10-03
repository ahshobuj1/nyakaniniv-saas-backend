import { InvoiceStatus, PaymentStatus } from '@/prisma/generated/client';

export type CancelledBy = 'CLIENT' | 'DJ' | 'SYSTEM';

export type RefundPolicyTier = 'FULL_REFUND' | 'PARTIAL_REFUND' | 'NO_REFUND';

/**
 * Lifecycle of a refund, stored in `booking.eventDetails.refundStatus`.
 * - NONE: booking was never paid, nothing to refund
 * - NO_REFUND: paid, but policy grants 0% back
 * - PROCESSING: gateway accepted the refund, awaiting settlement (or a request is in flight)
 * - COMPLETED: gateway confirmed the refund
 * - FAILED: gateway rejected the refund; the retry job will try again
 * - MANUAL_REQUIRED: cannot be automated (cash / unsupported gateway / retries exhausted)
 */
export type RefundStatus = 'NONE' | 'NO_REFUND' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'MANUAL_REQUIRED';

export interface RefundCalculation {
  refundPercent: number;
  refundAmount: number;
  /** Gross amount retained from the client (display only - the DJ's wallet share is net-based). */
  djCompensation: number;
  reason: string;
  policyTier: RefundPolicyTier;
}

/** Minimal booking shape required to evaluate the cancellation policy. */
export interface RefundableBooking {
  paymentStatus: PaymentStatus;
  totalAmount: unknown;
  eventDate: Date | null;
  invoice?: { status: InvoiceStatus } | null;
}

/** Refund/cancellation fields persisted inside `booking.eventDetails`. */
export interface BookingRefundDetails {
  cancelledBy?: CancelledBy;
  cancellationReason?: string;
  refundPercent?: number;
  refundAmount?: number;
  refundStatus?: RefundStatus;
  refundFailureReason?: string;
  refundAttempts?: number;
  refundProcessedAt?: string;
  /** True when a payment arrived after the booking was already cancelled/expired/rejected. */
  lateRefund?: boolean;
}

export interface GatewayRefundOutcome {
  status: RefundStatus;
  failureReason?: string;
}
