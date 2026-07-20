import axios from 'axios';
import { IPaymentProvider } from './IPaymentProvider';
import { Booking, Tenant, Client } from '@/prisma/generated/client';
import { BadRequestError } from '@/core/errors/AppError';

export class PaystackPaymentProvider implements IPaymentProvider {
  async getPaymentLink(booking: Booking & { tenant: Tenant | null, client?: Client | null }, paymentId: string): Promise<{ checkoutUrl: string }> {
    if (!booking.tenant?.paystackSubaccountId) {
      throw new BadRequestError('DJ has not configured Paystack payments yet');
    }

    if (!booking.client?.email) {
      throw new BadRequestError('Client email is required for Paystack payments');
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      throw new Error("Paystack secret key is not configured.");
    }

    const amountInKobo = Math.round(Number(booking.totalAmount) * 100);
    const platformFeeInKobo = Math.round(amountInKobo * 0.05);

    try {
      const response = await axios.post(
        'https://api.paystack.co/transaction/initialize',
        {
          email: booking.client.email,
          amount: amountInKobo,
          currency: "KES", // Currently default to KES based on initial requirement
          subaccount: booking.tenant.paystackSubaccountId,
          transaction_charge: platformFeeInKobo,
          bearer: "subaccount",
          callback_url: `https://${booking.tenant.subdomain}.upbeatafrica.com/payment-success?invoice_id=${paymentId}`,
          metadata: {
            invoiceId: paymentId,
            bookingId: booking.id,
          }
        },
        {
          headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = response.data;
      if (data.status && data.data?.authorization_url) {
        return { checkoutUrl: data.data.authorization_url };
      } else {
        throw new Error(data.message || "Failed to generate Paystack checkout URL");
      }
    } catch (error: any) {
      console.error("Paystack Init Error:", error.response?.data || error.message);
      throw new Error("An error occurred while initializing Paystack payment");
    }
  }
}
