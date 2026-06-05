import { PrismaClient, InvoicePaymentStatus, BookingStatus, NotificationType } from '@/prisma/generated/client';
import { BadRequestError } from '@/core/errors/AppError';
import Stripe from 'stripe';

export class WebhookServices {
  private stripe: any = null;

  constructor(private prisma: PrismaClient) {
    if (process.env.STRIPE_SECRET_KEY) {
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2024-04-10' as any,
      });
    }
  }

  async handleStripeWebhook(signature: string, rawBody: Buffer | string) {
    if (!this.stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('❌ [WEBHOOK] Stripe not configured');
      throw new BadRequestError('Stripe not configured');
    }

    let event: any;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
      console.log(`✅ [WEBHOOK] Successfully constructed event: ${event.type} [ID: ${event.id}]`);
    } catch (err: any) {
      console.error(`❌ [WEBHOOK] Invalid Stripe Signature: ${err.message}`);
      throw new BadRequestError('Invalid Stripe Signature');
    }

    // Save event for deduplication
    try {
      await this.prisma.webhookEvent.create({
        data: {
          stripeEventId: event.id,
          type: event.type,
          status: 'pending'
        }
      });
      console.log(`✅ [WEBHOOK] Saved new event for processing: ${event.id}`);
    } catch (err) {
      // Duplicate event
      console.log(`⚠️ [WEBHOOK] Duplicate event ignored: ${event.id}`);
      return { received: true };
    }

    if (event.type === 'checkout.session.completed' || event.type === 'payment_intent.succeeded') {
      const session = event.data.object as any;
      console.log(`📦 [WEBHOOK] Processing payload for ${event.type}:`, {
        metadata: session.metadata,
        amount_total: session.amount_total,
        subscription: session.subscription
      });
      
      const invoiceId = session.metadata?.invoiceId;
      const bookingId = session.metadata?.bookingId;
      const planId = session.metadata?.planId;
      const userId = session.metadata?.userId;
      const stripeSubId = session.subscription as string;
      const amountPaid = (session.amount_total || 0) / 100;

      // 1. Handle Booking Payments
      if (invoiceId) {
        // Run in transaction
        await this.prisma.$transaction(async (tx) => {
          // Update Invoice Status
          const invoice = await tx.invoice.update({
            where: { id: invoiceId },
            data: { status: InvoicePaymentStatus.paid },
            include: { booking: true }
          });

          // Use bookingId from metadata OR fallback to the one attached to the invoice
          const resolvedBookingId = bookingId || invoice.bookingId;

          // Update Booking Status
          if (resolvedBookingId) {
            const booking = await tx.booking.findUnique({ where: { id: resolvedBookingId } });
            if (booking && booking.status !== BookingStatus.completed) {
              await tx.booking.update({
                where: { id: resolvedBookingId },
                data: { status: BookingStatus.completed }
              });

              // Notify DJ
              if (booking.tenantId) {
                const tenant = await tx.tenant.findUnique({ where: { id: booking.tenantId } });
                if (tenant && tenant.userId) {
                  await tx.notification.create({
                    data: {
                      userId: tenant.userId as string,
                      title: 'Payment Received',
                      message: `Payment received for booking ${booking.eventType} from ${booking.clientName}.`,
                      type: NotificationType.payment
                    }
                  });
                }
              }
            }
          }
        });
      }

      // 2. Handle Subscription Payments
      if (userId && planId) {
        await this.prisma.$transaction(async (tx) => {
          await tx.subscription.create({
            data: {
              userId,
              planId: parseInt(planId, 10),
              stripeSubId: stripeSubId || 'one_time_sub', // If mode is not subscription
              status: 'active',
              periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // approx
            }
          });

          await tx.invoice.create({
            data: {
              userId,
              amount: amountPaid,
              type: 'SUBSCRIPTION',
              method: 'STRIPE',
              status: 'paid'
            }
          });
        });
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const stripeSub = event.data.object as any;
      await this.prisma.subscription.updateMany({
        where: { stripeSubId: stripeSub.id },
        data: { status: 'canceled' }
      });
    }

    await this.prisma.webhookEvent.update({
      where: { stripeEventId: event.id },
      data: { status: 'processed' }
    });

    return { received: true };
  }
}
