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
      throw new BadRequestError('Stripe not configured');
    }

    let event: any;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
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
    } catch (err) {
      // Duplicate event
      return { received: true };
    }

    if (event.type === 'checkout.session.completed' || event.type === 'payment_intent.succeeded') {
      const session = event.data.object as any;
      const invoiceId = session.metadata?.invoiceId;
      const bookingId = session.metadata?.bookingId;

      if (invoiceId && bookingId) {
        // Run in transaction
        await this.prisma.$transaction(async (tx) => {
          // 1. Update Invoice Status
          await tx.invoice.update({
            where: { id: invoiceId },
            data: { status: InvoicePaymentStatus.paid }
          });

          // 2. Update Booking Status (if it's not already completed)
          // We assume 'accepted' -> 'paid' -> done.
          const booking = await tx.booking.findUnique({ where: { id: bookingId } });
          if (booking && booking.status !== BookingStatus.completed) {
            await tx.booking.update({
              where: { id: bookingId },
              data: { status: BookingStatus.completed }
            });
          }

          // 3. Create Transaction Record (Basic Audit)
          // (Assuming we don't have a specific transaction model, we rely on the invoice payment status for now,
          //  but we can log a system notification or create a transaction if the schema has it. 
          //  Since there's no Transaction model in Prisma schema according to previous contexts, 
          //  we skip explicit transaction record or we could add it if it exists. Let's just create a Notification).

          // 4. Notify DJ
          if (booking && booking.tenantId) {
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
        });
      }
    }

    await this.prisma.webhookEvent.update({
      where: { stripeEventId: event.id },
      data: { status: 'processed' }
    });

    return { received: true };
  }
}
