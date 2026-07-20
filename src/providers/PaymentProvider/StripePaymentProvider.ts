import Stripe from 'stripe';
import { IPaymentProvider } from './IPaymentProvider';
import { Booking, Tenant } from '@/prisma/generated/client';
import { BadRequestError } from '@/core/errors/AppError';
import { config } from '@/core/config';

export class StripePaymentProvider implements IPaymentProvider {
  private stripe: any;

  constructor() {
    this.stripe = new Stripe(config.stripe.secretKey || process.env.STRIPE_SECRET_KEY || "", {
      apiVersion: "2024-04-10" as any,
    });
  }

  async getPaymentLink(booking: Booking & { tenant: Tenant | null }, paymentId: string): Promise<{ checkoutUrl: string }> {
    if (!booking.tenant?.stripeAccountId) {
      throw new BadRequestError('DJ has not configured Stripe payments yet');
    }

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Booking: ${booking.eventType}`,
              description: booking.eventDetails || "DJ Services",
            },
            unit_amount: Math.round(Number(booking.totalAmount) * 100), // Stripe takes cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `https://${booking.tenant.subdomain}.upbeatafrica.com/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `https://${booking.tenant.subdomain}.upbeatafrica.com/booking/${booking.id}`,
      payment_intent_data: {
        application_fee_amount: Math.round(Number(booking.totalAmount) * 100 * 0.05), // 5% Application Fee
        transfer_data: {
          destination: booking.tenant.stripeAccountId,
        },
      },
      metadata: {
        invoiceId: paymentId,
        bookingId: booking.id,
      }
    });

    if (!session.url) {
      throw new Error("Failed to generate Stripe checkout URL");
    }

    return { checkoutUrl: session.url };
  }
}
