import { PrismaClient } from '@/prisma/generated/client';
import { NotFoundError, BadRequestError, AuthorizationError } from '@/core/errors/AppError';
import Stripe from 'stripe';
import { CreateSubscriptionPlanDTO, SubscribeDTO, UpdateSubscriptionPlanDTO } from './SubscriptionDTO';
import { SubscriptionStatus, SubscriptionInvoiceStatus } from '@/prisma/generated/client';
import { IEmailProvider } from '@/providers/EmailProvider';
import { EmailTemplates } from '@/utils/EmailTemplates';

export class SubscriptionServices {
  private stripe: any = null;

  constructor(
    private prisma: PrismaClient,
    private emailProvider: IEmailProvider
  ) {
    if (process.env.STRIPE_SECRET_KEY) {
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: "2024-04-10" as any,
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

  async getAllPlans() {
    return this.prisma.subscriptionPlan.findMany({
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
        throw new BadRequestError('You already have an active subscription. Please cancel your current plan before switching to a new one.');
      }
    }

    if (!this.stripe) {
      // Mock logic if no Stripe keys are available yet
      const subscription = await this.prisma.subscription.create({
        data: {
          userId,
          planId: data.planId,
          status: SubscriptionStatus.active,
          stripeSubId: 'mock_sub_' + Date.now(),
          periodEnd: new Date(Date.now() + (data.billingCycle === 'monthly' ? 30 : 365) * 24 * 60 * 60 * 1000), // approx
        }
      });
      
      // Auto-generate invoice for mock payment
      await this.prisma.subscriptionInvoice.create({
        data: {
          userId,
          planId: data.planId,
          amount,
          status: SubscriptionInvoiceStatus.paid,
          stripeInvoiceId: 'mock_invoice_' + Date.now()
        }
      });

      return { url: 'http://localhost:3000/dashboard', subscription };
    }

    // Actual Stripe Logic using inline dynamic pricing (price_data)
    const unitAmount = Math.round(amount * 100); // Stripe requires cents

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${plan.name} Plan (${data.billingCycle})`,
            description: `Subscription to the ${plan.name} plan.`,
          },
          unit_amount: unitAmount,
          recurring: {
            interval: data.billingCycle === 'monthly' ? 'month' : 'year',
          },
        },
        quantity: 1,
      }],
      mode: 'subscription',
      success_url: data.successUrl || `${baseUrl}/dashboard?success=true`,
      cancel_url: data.cancelUrl || `${baseUrl}/pricing?canceled=true`,
      client_reference_id: userId,
      metadata: {
        userId,
        planId: plan.id.toString(),
        billingCycle: data.billingCycle,
      }
    });

    return { url: session.url };
  }

  async cancelSubscription(userId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { userId, status: SubscriptionStatus.active }
    });

    if (!subscription) {
      throw new NotFoundError();
    }

    if (this.stripe && subscription.stripeSubId && !subscription.stripeSubId.startsWith('mock_')) {
      await this.stripe.subscriptions.cancel(subscription.stripeSubId);
    }

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: SubscriptionStatus.canceled }
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user && user.email) {
      this.emailProvider.sendEmail(
        user.email,
        "Subscription Canceled - UpbeatAfrica",
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

    // Save event for deduplication/audit
    try {
      await this.prisma.webhookEvent.create({
        data: {
          stripeEventId: event.id,
          type: event.type,
          status: 'pending'
        }
      });
    } catch (err) {
      // If it already exists, it's a duplicate event
      return { received: true };
    }

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
        await this.prisma.subscriptionInvoice.create({
          data: {
            userId,
            planId: parseInt(planId, 10),
            amount: amountPaid,
            status: SubscriptionInvoiceStatus.paid,
            stripeInvoiceId: session.invoice ? (session.invoice as string) : 'stripe_mock'
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

    await this.prisma.webhookEvent.update({
      where: { stripeEventId: event.id },
      data: { status: 'processed' }
    });

    return { received: true };
  }
}
