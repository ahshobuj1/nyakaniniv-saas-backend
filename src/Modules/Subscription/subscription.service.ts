import { PrismaClient } from '@/prisma/generated/client';
import { NotFoundError, BadRequestError, AuthorizationError } from '@/core/errors/AppError';
import axios from 'axios';
import { CreateSubscriptionPlanDTO, SubscribeDTO, UpdateSubscriptionPlanDTO } from './SubscriptionDTO';
import { SubscriptionStatus, InvoiceStatus, InvoiceType, PaymentChannel, TransactionStatus } from '@/prisma/generated/client';
import { IEmailProvider } from '@/providers/EmailProvider';
import { EmailTemplates } from '@/utils/EmailTemplates';
import { PaymentProviderResolver } from '@/Modules/PaymentProvider/PaymentProviderResolver';
import { config } from '@/core/config';

export class SubscriptionServices {
  constructor(
    private prisma: PrismaClient,
    private emailProvider: IEmailProvider
  ) {}

  async createPlan(data: CreateSubscriptionPlanDTO) {
    const plan = await this.prisma.subscriptionPlan.create({
      data: {
        name: data.name,
        priceMonthly: data.priceMonthly,
        priceAnnually: data.priceAnnually,
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
      throw new BadRequestError('Cannot delete plan with active subscriptions.');
    }

    await this.prisma.subscriptionPlan.delete({ where: { id } });
    return { success: true };
  }

  async subscribe(userId: string, data: SubscribeDTO) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: data.planId } });
    if (!plan) {
      throw new NotFoundError('Subscription plan not found');
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

    const user = await this.prisma.user.findUnique({ 
      where: { id: userId },
      include: { tenant: true }
    });
    
    if (!user || !user.email) {
       throw new BadRequestError('User email is required for subscription payments');
    }

    const country = user.tenant?.country || 'KE';
    const provider = PaymentProviderResolver.resolve({
      country,
      operation: 'COLLECTION',
      requestedGateway: data.gateway,
    });

    const currencyMap: Record<string, string> = {
      NG: 'NGN',
      GH: 'GHS',
      ZA: 'ZAR',
      UG: 'UGX',
      RW: 'RWF',
      TZ: 'TZS',
      KE: 'KES',
    };
    const countryCode = PaymentProviderResolver.normalizeCountryCode(country);
    const currency = currencyMap[countryCode] || 'KES';

    // Create unpaid subscription invoice
    const invoice = await this.prisma.invoice.create({
      data: {
        userId,
        tenantId: user.tenant?.id,
        planId: data.planId,
        amount,
        currencyCode: currency,
        type: InvoiceType.SUBSCRIPTION,
        status: InvoiceStatus.UNPAID,
      }
    });

    const reference = `sub_${invoice.id.substring(0, 8)}_${Date.now()}`;
    const callbackUrl = data.successUrl || `${config.clientUrl}/dashboard/billing?success=true&reference=${reference}`;
    const cancelUrl = data.cancelUrl || `${config.clientUrl}/dashboard/billing?canceled=true&reference=${reference}`;

    const paymentResult = await provider.initializePayment({
      reference,
      amount,
      currency,
      email: user.email,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'DJ',
      description: `UpBeat Subscription: ${plan.name} (${data.billingCycle})`,
      callbackUrl,
      cancelUrl,
      paymentType: 'SUBSCRIPTION',
      country,
      metadata: {
        userId,
        planId: String(plan.id),
        billingCycle: data.billingCycle,
        invoiceId: invoice.id,
      },
    });

    // Create pending transaction record
    await this.prisma.transaction.create({
      data: {
        invoiceId: invoice.id,
        userId,
        tenantId: user.tenant?.id,
        amount,
        currency,
        gateway: provider.gateway,
        channel: PaymentChannel.UNKNOWN,
        status: TransactionStatus.PENDING,
        gatewayReference: reference,
        idempotencyKey: reference,
        grossAmount: amount,
        djNetEarning: 0,
        metadata: {
          planId: plan.id,
          billingCycle: data.billingCycle,
        },
      },
    });

    return { url: paymentResult.checkoutUrl };
  }

  getAvailableGateways(country?: string) {
    const c = (country || '').trim().toLowerCase();
    const isEastAfrica = ['tanzania', 'tz', 'kenya', 'ke', 'uganda', 'ug', 'rwanda', 'rw'].includes(c);

    if (isEastAfrica) {
      return [
        {
          id: 'pesapal',
          name: 'Pesapal',
          title: 'Mobile Money & Cards (East Africa)',
          description: 'M-Pesa, Tigo Pesa, Airtel Money, Visa & Mastercard',
          currencies: ['TZS', 'KES', 'UGX', 'RWF', 'USD'],
          isRecommended: true,
          badge: 'Recommended for East Africa',
          paymentMethods: ['M-Pesa', 'Tigo Pesa', 'Airtel Money', 'Cards']
        },
        {
          id: 'paystack',
          name: 'Paystack',
          title: 'Direct Card & Bank Checkout',
          description: 'Visa, Mastercard, Verve and direct international checkout',
          currencies: ['KES', 'NGN', 'GHS', 'ZAR', 'USD'],
          isRecommended: false,
          badge: 'Debit / Credit Cards',
          paymentMethods: ['Cards', 'Bank Transfer', 'Apple Pay']
        }
      ];
    }

    return [
      {
        id: 'paystack',
        name: 'Paystack',
        title: 'Paystack Payment Gateway',
        description: 'Cards, Bank Transfer, USSD & Apple Pay',
        currencies: ['NGN', 'GHS', 'ZAR', 'KES', 'USD'],
        isRecommended: true,
        badge: 'Recommended',
        paymentMethods: ['Cards', 'Bank Transfer', 'USSD']
      },
      {
        id: 'pesapal',
        name: 'Pesapal',
        title: 'Pesapal Gateway',
        description: 'Mobile Money and Regional Cards',
        currencies: ['TZS', 'KES', 'UGX', 'USD'],
        isRecommended: false,
        badge: 'East Africa / Mobile Money',
        paymentMethods: ['M-Pesa', 'Airtel Money', 'Cards']
      }
    ];
  }

  async validatePayoutAccount(data: {
    gateway: string;
    bankCode?: string;
    accountNumber: string;
    country?: string;
  }) {
    const gateway = (data.gateway || '').toLowerCase();
    const { bankCode, accountNumber, country } = data;

    if (!accountNumber || !accountNumber.trim()) {
      return { valid: false, message: 'Account or phone number is required.' };
    }

    if (gateway === 'paystack') {
      if (!bankCode) {
        return { valid: false, message: 'Bank selection is required for Paystack account verification.' };
      }
      const secretKey = process.env.PAYSTACK_SECRET_KEY;
      if (!secretKey) {
        return { valid: true, accountName: 'Test Verified Account (Dev Mode)' };
      }

      try {
        const response = await axios.get(
          `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(accountNumber.trim())}&bank_code=${encodeURIComponent(bankCode.trim())}`,
          {
            headers: {
              Authorization: `Bearer ${secretKey}`,
            },
          }
        );
        if (response.data?.status && response.data?.data?.account_name) {
          return {
            valid: true,
            accountName: response.data.data.account_name,
            accountNumber: response.data.data.account_number,
          };
        } else {
          return {
            valid: false,
            message: response.data?.message || 'Could not verify account name with bank.',
          };
        }
      } catch (err: any) {
        const errMsg = err.response?.data?.message || 'Invalid account number or bank code.';
        return { valid: false, message: errMsg };
      }
    }

    // Pesapal / East Africa Mobile Money format validation
    const cleaned = accountNumber.replace(/[\s-+]/g, '');
    const isDigitsOnly = /^\d+$/.test(cleaned);
    if (!isDigitsOnly || cleaned.length < 9 || cleaned.length > 13) {
      return {
        valid: false,
        message: 'Invalid phone number. Mobile money numbers must be 9 to 12 digits (e.g. 0712345678).'
      };
    }

    return {
      valid: true,
      accountName: 'Verified Mobile Money Account'
    };
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
}
