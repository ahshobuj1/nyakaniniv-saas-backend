import { PrismaClient, BookingStatus, NotificationType, InvoiceStatus, InvoiceType } from '@/prisma/generated/client';
import { BadRequestError } from '@/core/errors/AppError';
import Stripe from 'stripe';
import { IEmailProvider } from '@/providers/EmailProvider';
import { EmailTemplates } from '@/utils/EmailTemplates';
import { InvoiceServices } from '../Invoice/invoice.service';
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

  // Stripe webhook handling was removed.

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
      console.error(`Expected: ${hash}`);
      console.error(`Received: ${signature}`);
      throw new BadRequestError('Invalid Paystack Signature');
    }

    const event = typeof rawBody === 'string' || Buffer.isBuffer(rawBody) 
      ? JSON.parse(rawBody.toString()) 
      : rawBody;

    console.log(`✅ [WEBHOOK] Verified Paystack event: ${event.event} [ID: ${event.data?.id}]`);

    if (event.event === 'charge.success') {
      const data = event.data;
      const metadata = typeof data.metadata === 'string' ? JSON.parse(data.metadata) : data.metadata || {};
      const invoiceId = metadata.invoiceId;
      const bookingId = metadata.bookingId;
      const amountPaid = (data.amount || 0) / 100;
      const type = metadata.type;
      const userId = metadata.userId;
      const planId = metadata.planId;

      if (type === 'subscription' && userId && planId) {
        // Handle Subscription Payments
        await this.prisma.$transaction(async (tx) => {
          await tx.subscription.create({
            data: {
              userId,
              planId: parseInt(planId, 10),
              stripeSubId: 'paystack_sub_' + (data.reference || Date.now()), // storing reference
              status: 'active',
              periodEnd: new Date(Date.now() + (data.metadata?.billingCycle === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000)
            }
          });

          const newInvoice = await tx.invoice.create({
            data: {
              userId,
              planId: parseInt(planId, 10),
              amount: amountPaid,
              status: 'PAID',
              type: 'SUBSCRIPTION'
            }
          });

          await tx.transaction.create({
            data: {
              invoiceId: newInvoice.id,
              userId,
              amount: amountPaid,
              gateway: 'PAYSTACK',
              channel: data.authorization?.channel?.toUpperCase() || 'CARD',
              status: 'SUCCESS',
              gatewayReference: data.reference,
              cardBrand: data.authorization?.card_type || data.authorization?.brand || null,
              cardLast4: data.authorization?.last4 || null,
              bankName: data.authorization?.bank || null,
            }
          });

          await tx.tenant.updateMany({
            where: { userId },
            data: {
              activePlanId: parseInt(planId, 10),
              subscriptionStatus: 'active'
            }
          });
        });

        // Send Emails for Subscription
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (user && user.email) {
          const nextBilling = new Date(Date.now() + (data.metadata?.billingCycle === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000).toISOString();
          
          this.emailProvider.sendEmail(
            user.email,
            "Subscription Activated 🚀 - UpBeat Africa",
            EmailTemplates.getSubscriptionActivatedTemplate(`Plan ${planId}`, nextBilling)
          );

          this.emailProvider.sendEmail(
            config.defaultAdmin?.email || "admin@upbeatafrica.com",
            "New Subscription Alert - UpBeat Africa",
            EmailTemplates.getNewSubscriptionAdminAlertTemplate(user.email, parseInt(planId, 10))
          );
        }
      } else if (invoiceId || bookingId) {
        const txResult = await this.prisma.$transaction(async (tx) => {
          let eventType = "Event";
          let clientName = "Client";
          let eventDate = new Date().toISOString();
          let resolvedBookingId = bookingId;
          let djEmail: string | null = null;
          let clientEmail: string | null = null;
          let djName: string | null = null;

          const invoice = await tx.invoice.findFirst({
            where: {
              OR: [
                ...(invoiceId ? [{ id: invoiceId }] : []),
                ...(resolvedBookingId ? [{ bookingId: resolvedBookingId }] : []),
              ]
            }
          });
            
          if (invoice && invoice.status !== 'PAID') {
            await tx.invoice.update({
              where: { id: invoice.id },
              data: { status: 'PAID' }
            });

            await tx.transaction.create({
              data: {
                invoiceId: invoice.id,
                tenantId: invoice.tenantId,
                amount: amountPaid,
                gateway: 'PAYSTACK',
                channel: data.authorization?.channel?.toUpperCase() || 'CARD',
                status: 'SUCCESS',
                gatewayReference: data.reference,
                cardBrand: data.authorization?.card_type || data.authorization?.brand || null,
                cardLast4: data.authorization?.last4 || null,
                bankName: data.authorization?.bank || null,
              }
            });
          } else {
            console.warn(`⚠️ [WEBHOOK] Invoice not found or already paid for invoiceId: ${invoiceId}, bookingId: ${resolvedBookingId}`);
          }

          resolvedBookingId = resolvedBookingId || invoice?.bookingId;

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
                        type: NotificationType.payment,
                        referenceId: invoice?.id || resolvedBookingId,
                      }
                    });
                  }
                }
              }
            }
          }
          return { djEmail, clientEmail, djName, eventType, clientName, eventDate, resolvedBookingId, paymentId: invoice?.id };
        });
        if (txResult.djEmail) {
          this.emailProvider.sendEmail(
            txResult.djEmail,
            "Payment Received! 💰 - UpBeat Africa",
            EmailTemplates.getPaymentReceivedAlertTemplate(txResult.clientName, amountPaid)
          );
        }

        if (txResult.clientEmail && txResult.resolvedBookingId) {
          this.emailProvider.sendEmail(
            txResult.clientEmail,
            "Payment Receipt - UpBeat Africa",
            EmailTemplates.getPaymentReceiptTemplate(
              amountPaid, 
              txResult.eventType,
              txResult.djName || "DJ",
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
