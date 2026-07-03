import { PrismaClient, BookingPaymentStatus, BookingStatus, SubscriptionInvoiceStatus, NotificationType } from '@/prisma/generated/client';
import { BadRequestError } from '@/core/errors/AppError';
import Stripe from 'stripe';
import { IEmailProvider } from '@/providers/EmailProvider';
import { EmailTemplates } from '@/utils/EmailTemplates';
import { config } from '@/core/config';
import { AppLogger } from '@/core/logging/logger';
import crypto from 'crypto';

export class WebhookServices {
  private stripe: any = null;

  constructor(
    private prisma: PrismaClient,
    private emailProvider: IEmailProvider
  ) {
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
      if (invoiceId || bookingId) {
        const txResult = await this.prisma.$transaction(async (tx) => {
          let djEmail = null;
          let clientEmail = null;
          let djName = "DJ";
          let eventType = "Event";
          let clientName = "Client";
          let eventDate = new Date().toISOString();
          let resolvedBookingId = bookingId;

          const payment = await tx.bookingPayment.findUnique({ where: { id: invoiceId || '' } });
          if (payment) {
            await tx.bookingPayment.update({
              where: { id: payment.id },
              data: { status: BookingPaymentStatus.paid }
            });
          }

          resolvedBookingId = resolvedBookingId || payment?.bookingId;

          if (resolvedBookingId) {
            const booking = await tx.booking.findUnique({ where: { id: resolvedBookingId }, include: { client: true } });
            if (booking && booking.status !== BookingStatus.completed) {
              await tx.booking.update({
                where: { id: resolvedBookingId },
                data: { status: BookingStatus.completed }
              });

              eventType = booking.eventType || "Event";
              clientName = booking.client?.name || "Client";
              clientEmail = booking.client?.email || null;
              eventDate = booking.eventDate?.toISOString() || new Date().toISOString();

              if (booking.tenantId) {
                const tenant = await tx.tenant.findUnique({ where: { id: booking.tenantId }, include: { user: true } });
                if (tenant) {
                  djName = tenant.stageName || tenant.user?.firstName || "DJ";
                  if (tenant.user) {
                    djEmail = tenant.user.email;
                    await tx.notification.create({
                      data: {
                        userId: tenant.user.id,
                        title: 'Payment Received',
                        message: `Payment received for booking ${eventType} from ${clientName}.`,
                        type: NotificationType.payment
                      }
                    });
                  }
                }
              }
            }
          }
          return { djEmail, clientEmail, djName, eventType, clientName, eventDate, resolvedBookingId };
        });

        // Send Emails outside transaction
        if (txResult.djEmail) {
          this.emailProvider.sendEmail(
            txResult.djEmail,
            "Payment Received! 💰 - UpbeatAfrica",
            EmailTemplates.getPaymentReceivedAlertTemplate(txResult.clientName, amountPaid)
          );
        }

        if (txResult.clientEmail && txResult.resolvedBookingId) {
          this.emailProvider.sendEmail(
            txResult.clientEmail,
            "Payment Receipt - UpbeatAfrica",
            EmailTemplates.getPaymentReceiptTemplate(
              amountPaid, 
              txResult.eventType,
              txResult.djName,
              txResult.eventDate,
              "Stripe / Credit Card",
              txResult.resolvedBookingId
            )
          );
        }
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
              periodEnd: new Date(Date.now() + (session.metadata?.billingCycle === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000)
            }
          });

          await tx.subscriptionInvoice.create({
            data: {
              userId,
              planId: parseInt(planId, 10),
              amount: amountPaid,
              status: SubscriptionInvoiceStatus.paid,
              stripeInvoiceId: session.invoice ? (session.invoice as string) : 'stripe_mock'
            }
          });
        });

        // Send Emails for Subscription
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (user && user.email) {
          const nextBilling = new Date(Date.now() + (session.metadata?.billingCycle === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000).toISOString();
          
          this.emailProvider.sendEmail(
            user.email,
            "Subscription Activated 🚀 - UpbeatAfrica",
            EmailTemplates.getSubscriptionActivatedTemplate(`Plan ${planId}`, nextBilling)
          );

          this.emailProvider.sendEmail(
            config.defaultAdmin?.email || "admin@upbeatafrica.com",
            "New Subscription Alert 💸 - UpbeatAfrica",
            EmailTemplates.getNewSubscriptionAdminAlertTemplate(user.email, parseInt(planId, 10))
          );
        }
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const stripeSub = event.data.object as any;
      const sub = await this.prisma.subscription.findFirst({
        where: { stripeSubId: stripeSub.id },
        include: { user: true }
      });

      if (sub) {
        await this.prisma.$transaction(async (tx) => {
          await tx.subscription.update({
            where: { id: sub.id },
            data: { status: 'canceled' }
          });
          
          await tx.tenant.updateMany({
            where: { userId: sub.userId },
            data: { subscriptionStatus: 'canceled' }
          });
        });

        if (sub.user && sub.user.email) {
          this.emailProvider.sendEmail(
            sub.user.email,
            "Subscription Canceled - UpbeatAfrica",
            EmailTemplates.getSubscriptionCanceledTemplate()
          );
        }
      }
    } else if (event.type === 'customer.subscription.updated') {
      const stripeSub = event.data.object as any;
      const planIdStr = stripeSub.metadata?.planId;
      
      if (planIdStr) {
        const newPlanId = parseInt(planIdStr, 10);
        const sub = await this.prisma.subscription.findFirst({
          where: { stripeSubId: stripeSub.id },
          include: { user: true }
        });

        if (sub && sub.planId !== newPlanId) {
          await this.prisma.subscription.update({
            where: { id: sub.id },
            data: { planId: newPlanId }
          });

          if (sub.user && sub.user.email) {
            this.emailProvider.sendEmail(
              sub.user.email,
              "Subscription Updated - UpbeatAfrica",
              EmailTemplates.getSubscriptionChangedTemplate(newPlanId)
            );
          }
        }
      }
    } else if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as any;
      const stripeSubId = invoice.subscription as string;
      const sub = await this.prisma.subscription.findFirst({
        where: { stripeSubId },
        include: { user: true }
      });

      if (sub && sub.user && sub.user.email) {
        this.emailProvider.sendEmail(
          sub.user.email,
          "Payment Failed ⚠️ - UpbeatAfrica",
          EmailTemplates.getPaymentFailedTemplate()
        );
      }
    }

    await this.prisma.webhookEvent.update({
      where: { stripeEventId: event.id },
      data: { status: 'processed' }
    });

    return { received: true };
  }

  async handlePaystackWebhook(signature: string, rawBody: Buffer | string | any) {
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) {
      console.error('❌ [WEBHOOK] Paystack not configured');
      throw new BadRequestError('Paystack not configured');
    }

    const payload = typeof rawBody === 'string' || Buffer.isBuffer(rawBody) 
      ? rawBody 
      : JSON.stringify(rawBody);

    const hash = crypto.createHmac('sha512', secret).update(payload).digest('hex');

    if (hash !== signature) {
      console.error('❌ [WEBHOOK] Invalid Paystack Signature');
      throw new BadRequestError('Invalid Paystack Signature');
    }

    const event = typeof rawBody === 'string' || Buffer.isBuffer(rawBody) 
      ? JSON.parse(rawBody.toString()) 
      : rawBody;

    console.log(`✅ [WEBHOOK] Verified Paystack event: ${event.event} [ID: ${event.data?.id}]`);

    if (event.event === 'charge.success') {
      const data = event.data;
      const invoiceId = data.metadata?.invoiceId;
      const bookingId = data.metadata?.bookingId;
      const amountPaid = (data.amount || 0) / 100;

      if (invoiceId || bookingId) {
        const txResult = await this.prisma.$transaction(async (tx) => {
          let djEmail = null;
          let clientEmail = null;
          let djName = "DJ";
          let eventType = "Event";
          let clientName = "Client";
          let eventDate = new Date().toISOString();
          let resolvedBookingId = bookingId;

          const payment = await tx.bookingPayment.findUnique({ where: { id: invoiceId || '' } });
          if (payment && payment.status !== BookingPaymentStatus.paid) {
            await tx.bookingPayment.update({
              where: { id: payment.id },
              data: { status: BookingPaymentStatus.paid }
            });
          }

          resolvedBookingId = resolvedBookingId || payment?.bookingId;

          if (resolvedBookingId) {
            const booking = await tx.booking.findUnique({ where: { id: resolvedBookingId }, include: { client: true } });
            if (booking && booking.status !== BookingStatus.completed) {
              await tx.booking.update({
                where: { id: resolvedBookingId },
                data: { status: BookingStatus.completed }
              });

              eventType = booking.eventType || "Event";
              clientName = booking.client?.name || "Client";
              clientEmail = booking.client?.email || null;
              eventDate = booking.eventDate?.toISOString() || new Date().toISOString();

              if (booking.tenantId) {
                const tenant = await tx.tenant.findUnique({ where: { id: booking.tenantId }, include: { user: true } });
                if (tenant) {
                  djName = tenant.stageName || tenant.user?.firstName || "DJ";
                  if (tenant.user) {
                    djEmail = tenant.user.email;
                    await tx.notification.create({
                      data: {
                        userId: tenant.user.id,
                        title: 'Payment Received via Paystack',
                        message: `Payment received for booking ${eventType} from ${clientName}.`,
                        type: NotificationType.payment
                      }
                    });
                  }
                }
              }
            }
          }
          return { djEmail, clientEmail, djName, eventType, clientName, eventDate, resolvedBookingId };
        });

        // Send Emails outside transaction
        if (txResult.djEmail) {
          this.emailProvider.sendEmail(
            txResult.djEmail,
            "Payment Received! 💰 - UpbeatAfrica",
            EmailTemplates.getPaymentReceivedAlertTemplate(txResult.clientName, amountPaid)
          );
        }

        if (txResult.clientEmail && txResult.resolvedBookingId) {
          this.emailProvider.sendEmail(
            txResult.clientEmail,
            "Payment Receipt - UpbeatAfrica",
            EmailTemplates.getPaymentReceiptTemplate(
              amountPaid, 
              txResult.eventType,
              txResult.djName,
              txResult.eventDate,
              "Paystack",
              txResult.resolvedBookingId
            )
          );
        }
      }
    }

    return { received: true };
  }
}
