import { Booking, Tenant } from '@/prisma/generated/client';

export interface IPaymentProvider {
  /**
   * Generates a checkout URL for a booking payment.
   * @param booking The booking object including tenant details
   * @param paymentId The ID of the BookingPayment record
   */
  getPaymentLink(booking: Booking & { tenant: Tenant | null }, paymentId: string): Promise<{ checkoutUrl: string }>;
}
