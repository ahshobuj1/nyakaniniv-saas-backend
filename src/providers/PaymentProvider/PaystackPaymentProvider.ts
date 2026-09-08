import axios from 'axios';
import { IPaymentProvider } from './IPaymentProvider';
import { Booking, Tenant, Client } from '@/prisma/generated/client';
import { BadRequestError } from '@/core/errors/AppError';

export class PaystackPaymentProvider implements IPaymentProvider {
  async getPaymentLink(booking: Booking & { tenant: Tenant | null, client?: Client | null }, paymentId: string): Promise<{ checkoutUrl: string }> {
    const hasPaystack = booking.tenant?.paystackSubaccountId || 
      (booking.tenant as any)?.paymentAccounts?.some((acc: any) => acc.gateway === 'PAYSTACK' && acc.isActive);

    if (!hasPaystack) {
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
    const currencyToUse = (booking as any).currencyCode || "KES";

    const callbackBaseUrl = booking.tenant?.subdomain
      ? (process.env.NODE_ENV === 'production'
          ? `https://${booking.tenant.subdomain}.deejay.africa`
          : `http://${booking.tenant.subdomain}.localhost:3000`)
      : (process.env.CLIENT_URL || "http://localhost:3000");

    const callbackUrl = `${callbackBaseUrl}/payment-success?provider=paystack`;

    const subaccountCode = booking.tenant?.paystackSubaccountId || 
      (booking.tenant as any)?.paymentAccounts?.find((acc: any) => acc.gateway === 'PAYSTACK' && acc.isActive)?.subaccountId;

    const payload: any = {
      email: booking.client.email,
      amount: amountInKobo,
      currency: currencyToUse,
      callback_url: callbackUrl,
      metadata: {
        invoiceId: paymentId,
        bookingId: booking.id,
        tenantId: booking.tenantId,
        subaccountCode: subaccountCode || null,
      },
    };

    if (subaccountCode && !subaccountCode.startsWith('ACCT_test_')) {
      payload.subaccount = subaccountCode;
      payload.bearer = 'subaccount';
    }

    try {
      const response = await axios.post(
        'https://api.paystack.co/transaction/initialize',
        payload,
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
