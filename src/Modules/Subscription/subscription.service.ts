import { PrismaClient } from '@/prisma/generated/client';
import { NotFoundError, BadRequestError, AuthorizationError } from '@/core/errors/AppError';
import axios from 'axios';
import { CreateSubscriptionPlanDTO, SubscribeDTO, UpdateSubscriptionPlanDTO } from './SubscriptionDTO';
import { SubscriptionStatus, InvoiceStatus, InvoiceType } from '@/prisma/generated/client';
import { IEmailProvider } from '@/providers/EmailProvider';
import { EmailTemplates } from '@/utils/EmailTemplates';
import Stripe from 'stripe';

export class SubscriptionServices {
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

  async createPlan(data: CreateSubscriptionPlanDTO) {
    const plan = await this.prisma.subscriptionPlan.create({
      data: {
        name: data.name,
        priceMonthly: data.priceMonthly,
        priceAnnually: data.priceAnnually,
        stripeMonthlyPriceId: data.stripeMonthlyPriceId,
        stripeAnnualPriceId: data.stripeAnnualPriceId,
        discountPercentage: data.discountPercentage,
        features: data.features ? (data.features as any) : {},
      },
    });
    return plan;
  }

  async getAllPlans(all?: boolean) {
    const where = all ? {} : { isActive: true };
    return this.prisma.subscriptionPlan.findMany({
      where,
      orderBy: { priceMonthly: 'asc' },
    });
  }

  async getMySubscription(userId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { userId, status: SubscriptionStatus.active },
      include: { plan: true },
      orderBy: { createdAt: 'desc' }
    });

    if (!subscription) {
      return null;
    }

    return subscription;
  }

  async updatePlan(id: number, data: UpdateSubscriptionPlanDTO) {
    const existing = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError();
    }

    return this.prisma.subscriptionPlan.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name : existing.name,
        priceMonthly: data.priceMonthly !== undefined ? data.priceMonthly : existing.priceMonthly,
        priceAnnually: data.priceAnnually !== undefined ? data.priceAnnually : existing.priceAnnually,
        stripeMonthlyPriceId: data.stripeMonthlyPriceId !== undefined ? data.stripeMonthlyPriceId : existing.stripeMonthlyPriceId,
        stripeAnnualPriceId: data.stripeAnnualPriceId !== undefined ? data.stripeAnnualPriceId : existing.stripeAnnualPriceId,
        discountPercentage: data.discountPercentage !== undefined ? data.discountPercentage : existing.discountPercentage,
        isActive: data.isActive !== undefined ? data.isActive : existing.isActive,
        features: data.features !== undefined ? data.features : (existing.features as any),
      },
    });
  }

  async deletePlan(id: number) {
    const existing = await this.prisma.subscriptionPlan.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError();
    }

    // Make sure no active subscriptions are linked to this plan before deleting.
    const activeSubs = await this.prisma.subscription.count({
      where: { planId: id, status: SubscriptionStatus.active }
    });

    if (activeSubs > 0) {
      throw new BadRequestError();
    }

    await this.prisma.subscriptionPlan.delete({ where: { id } });
    return { success: true };
  }

  async subscribe(userId: string, data: SubscribeDTO) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: data.planId } });
    if (!plan) {
      throw new NotFoundError();
    }

    const amountStr = data.billingCycle === 'monthly' ? plan.priceMonthly : plan.priceAnnually;
    const amount = Number(amountStr) || 0;

    const activeSub = await this.prisma.subscription.findFirst({
      where: { userId, status: SubscriptionStatus.active }
    });

    if (activeSub) {
      if (activeSub.planId === data.planId) {
        throw new BadRequestError('You are already subscribed to this plan.');
      } else {
        throw new BadRequestError('You already have an active subscription. Please cancel your current plan before switching.');
      }
    }

    const secretKey = process.env.PAYSTACK_SECRET_KEY;
    if (!secretKey) {
      // Mock logic if no Paystack keys are available yet
      const subscription = await this.prisma.subscription.create({
        data: {
          userId,
          planId: data.planId,
          status: SubscriptionStatus.active,
          stripeSubId: 'mock_sub_' + Date.now(), // Still using stripeSubId column as a generic reference
          periodEnd: new Date(Date.now() + (data.billingCycle === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000), // approx
        }
      });
      
      // Auto-generate invoice for mock payment
      await this.prisma.invoice.create({
        data: {
          userId,
          planId: data.planId,
          amount,
          type: InvoiceType.SUBSCRIPTION,
          status: InvoiceStatus.PAID,
        }
      });

      return { url: 'https://upbeat.africa/dashboard', subscription };
    }

    // Actual Paystack Logic
    const amountInKobo = Math.round(amount * 100); 
    const baseUrl = process.env.FRONTEND_URL || 'https://upbeat.africa';
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    
    if (!user || !user.email) {
       throw new BadRequestError('User email is required for Paystack payments');
    }

    try {
      const response = await axios.post(
        'https://api.paystack.co/transaction/initialize',
        {
          email: user.email,
          amount: amountInKobo,
          currency: 'KES',
          callback_url: data.successUrl || `${baseUrl}/dashboard/billing?success=true`,
          metadata: {
            userId,
            planId: plan.id.toString(),
            billingCycle: data.billingCycle,
            type: 'subscription'
          }
        },
        {
          headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const responseData = response.data;
      if (responseData.status && responseData.data?.authorization_url) {
        return { url: responseData.data.authorization_url };
      } else {
        throw new Error(responseData.message || "Failed to generate Paystack checkout URL");
      }
    } catch (error: any) {
      console.error("Paystack Init Error:", error.response?.data || error.message);
      throw new BadRequestError("An error occurred while initializing Paystack payment");
    }
  }

  async cancelSubscription(userId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { userId, status: SubscriptionStatus.active }
    });

    if (!subscription) {
      throw new NotFoundError();
    }

    // If we have Paystack recurring integrations in the future, cancel here.
    // For now, we rely on local DB cancellation.

    await this.prisma.$transaction(async (tx) => {
      await tx.subscription.update({
        where: { id: subscription.id },
        data: { status: SubscriptionStatus.canceled }
      });
      
      await tx.tenant.updateMany({
        where: { userId },
        data: { subscriptionStatus: 'canceled' }
      });
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user && user.email) {
      this.emailProvider.sendEmail(
        user.email,
        "Subscription Canceled - UpBeat Entertainment Africa",
        EmailTemplates.getSubscriptionCanceledTemplate()
      );
    }

    return { success: true, message: 'Subscription canceled' };
  }

  async handleStripeWebhook(signature: string, rawBody: string) {
    if (!this.stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
      throw new BadRequestError();
    }

    let event: any;
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err: any) {
      throw new BadRequestError();
    }

    // Removed webhook event logic because we removed WebhookEvent model
    // Just parse and continue


    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      const userId = session.metadata?.userId;
      const planId = session.metadata?.planId;
      const stripeSubId = session.subscription as string;
      const amountPaid = (session.amount_total || 0) / 100;

      if (userId && planId) {
        await this.prisma.subscription.create({
          data: {
            userId,
            planId: parseInt(planId, 10),
            stripeSubId,
            status: SubscriptionStatus.active,
            periodEnd: new Date(Date.now() + (session.metadata?.billingCycle === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000)
          }
        });

        // Auto-generate invoice for actual Stripe payment
        await this.prisma.invoice.create({
          data: {
            userId,
            planId: parseInt(planId, 10),
            amount: amountPaid,
            type: InvoiceType.SUBSCRIPTION,
            status: InvoiceStatus.PAID,
          }
        });
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const stripeSub = event.data.object as any;
      await this.prisma.subscription.updateMany({
        where: { stripeSubId: stripeSub.id },
        data: { status: SubscriptionStatus.canceled }
      });
    }

    // Process specific events
    if (event.type === 'invoice.payment_succeeded') {
      const invoiceData = event.data.object;
      
      const sub = await this.prisma.subscription.findFirst({ where: { stripeSubId: invoiceData.subscription } });
      if (sub) {
        await this.prisma.$transaction(async (tx) => {
          await tx.subscription.update({
            where: { id: sub.id },
            data: { status: SubscriptionStatus.active }
          });
          
          await tx.invoice.create({
            data: {
              userId: sub.userId,
              planId: sub.planId,
              amount: invoiceData.amount_paid / 100, // assuming cents
              type: InvoiceType.SUBSCRIPTION,
              status: InvoiceStatus.PAID,
            }
          });
        });
      }
    } else if (event.type === 'invoice.payment_failed') {
      const invoiceData = event.data.object;
      const sub = await this.prisma.subscription.findFirst({ where: { stripeSubId: invoiceData.subscription } });
      if (sub) {
        await this.prisma.$transaction(async (tx) => {
          await tx.subscription.update({
            where: { id: sub.id },
            data: { status: SubscriptionStatus.past_due }
          });
        });
      }
    }

    return { received: true };
  }
}
