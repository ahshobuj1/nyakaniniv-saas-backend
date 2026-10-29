import {PrismaClient} from '@/prisma/generated/client';
import {NotFoundError, BadRequestError} from '@/core/errors/AppError';
import axios from 'axios';
import {
  CreateSubscriptionPlanDTO,
  SubscribeDTO,
  UpdateSubscriptionPlanDTO,
  SetPlanPriceDTO,
  ToggleCurrencyDTO,
} from './SubscriptionDTO';
import {
  SubscriptionStatus,
  InvoiceStatus,
  InvoiceType,
  PaymentChannel,
  TransactionStatus,
  PaymentGateway,
} from '@/prisma/generated/client';
import {IEmailProvider} from '@/providers/EmailProvider';
import {PaymentProviderResolver} from '@/Modules/PaymentProvider/PaymentProviderResolver';
import {config} from '@/core/config';

export class SubscriptionServices {
  constructor(
    private prisma: PrismaClient,
    private emailProvider: IEmailProvider,
  ) {}

  /**
   * Validate requested currency against the Currency table.
   * If not found or not active, falls back to KES (Paystack default for Kenya).
   * USD is NOT accepted on this platform.
   */
  async resolveValidCurrency(requestedCurrency?: string, country?: string | null): Promise<string> {
    let candidate = (requestedCurrency || '').trim().toUpperCase();

    // Reject USD explicitly — platform does not accept USD payments
    if (candidate === 'USD') {
      candidate = '';
    }

    if (!candidate && country) {
      candidate = PaymentProviderResolver.resolveCurrencyFromCountry(country);
    }

    if (candidate) {
      const dbCurr = await this.prisma.currency.findUnique({
        where: { code: candidate },
      });
      if (dbCurr && dbCurr.isActive) {
        return candidate;
      }
    }

    // Server-side fallback: default to KES (Paystack Kenya account)
    return 'KES';
  }

  /**
   * Resolve active plan price for a given currency and billing cycle.
   * If requested currency has no active price, fall back to USD.
   */
  async resolvePlanPrice(
    planId: number,
    targetCurrency: string,
    cycle: 'monthly' | 'annually',
  ): Promise<{ amount: number; currency: string; isFallback: boolean }> {
    // 1. Check if active price exists for targetCurrency
    let planPrice = await this.prisma.subscriptionPlanPrice.findFirst({
      where: { planId, currencyCode: targetCurrency, isActive: true },
    });
    let finalCurrency = targetCurrency;

    // 2. If no active price for requested currency, fall back to KES
    if (!planPrice && targetCurrency !== 'KES') {
      planPrice = await this.prisma.subscriptionPlanPrice.findFirst({
        where: { planId, currencyCode: 'KES', isActive: true },
      });
      if (planPrice) {
        finalCurrency = 'KES';
      }
    }

    // 3. Return resolved price
    if (planPrice) {
      const amount = cycle === 'monthly' ? Number(planPrice.priceMonthly) : Number(planPrice.priceAnnually);
      return { amount, currency: finalCurrency, isFallback: finalCurrency !== targetCurrency };
    }

    // 4. Ultimate fallback to KES (platform default — Paystack Kenya)
    const kesPrice = await this.prisma.subscriptionPlanPrice.findFirst({
      where: { planId, currencyCode: 'KES', isActive: true },
    });
    if (kesPrice) {
      const amount = cycle === 'monthly' ? Number(kesPrice.priceMonthly) : Number(kesPrice.priceAnnually);
      return { amount, currency: 'KES', isFallback: true };
    }
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    const amount = cycle === 'monthly' ? Number(plan?.priceMonthly || 0) : Number(plan?.priceAnnually || 0);
    return { amount, currency: 'KES', isFallback: true };
  }

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

  async getAllPlans(currency?: string, all?: boolean) {
    const where = all ? {} : {isActive: true};
    const targetCurrency = await this.resolveValidCurrency(currency);

    const plans = await this.prisma.subscriptionPlan.findMany({
      where,
      include: {
        prices: {
          where: { isActive: true },
        },
      },
      orderBy: {id: 'asc'},
    });

    const mappedPlans = plans.map((plan) => {
      let activePrice = plan.prices.find((p) => p.currencyCode === targetCurrency);
      let displayCurrency = targetCurrency;

      if (!activePrice && targetCurrency !== 'USD') {
        activePrice = plan.prices.find((p) => p.currencyCode === 'USD');
        if (activePrice) displayCurrency = 'USD';
      }

      const priceMonthly = activePrice
        ? Number(activePrice.priceMonthly)
        : Number(plan.priceMonthly || 0);

      const priceAnnually = activePrice
        ? Number(activePrice.priceAnnually)
        : Number(plan.priceAnnually || 0);

      if (!activePrice && !plan.prices.length) {
        displayCurrency = 'USD';
      }

      return {
        ...plan,
        currencyCode: displayCurrency,
        priceMonthly,
        priceAnnually,
        availablePrices: plan.prices,
      };
    });

    return mappedPlans.sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
  }

  async getMySubscription(userId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: {userId, status: SubscriptionStatus.active},
      include: {plan: true},
      orderBy: {createdAt: 'desc'},
    });

    if (!subscription) {
      return null;
    }

    return subscription;
  }

  async updatePlan(id: number, data: UpdateSubscriptionPlanDTO) {
    const existing = await this.prisma.subscriptionPlan.findUnique({
      where: {id},
    });
    if (!existing) {
      throw new NotFoundError();
    }

    return this.prisma.subscriptionPlan.update({
      where: {id},
      data: {
        name: data.name !== undefined ? data.name : existing.name,
        priceMonthly:
          data.priceMonthly !== undefined
            ? data.priceMonthly
            : existing.priceMonthly,
        priceAnnually:
          data.priceAnnually !== undefined
            ? data.priceAnnually
            : existing.priceAnnually,
        discountPercentage:
          data.discountPercentage !== undefined
            ? data.discountPercentage
            : existing.discountPercentage,
        isActive:
          data.isActive !== undefined ? data.isActive : existing.isActive,
        features:
          data.features !== undefined
            ? data.features
            : (existing.features as any),
      },
    });
  }

  async deletePlan(id: number) {
    const existing = await this.prisma.subscriptionPlan.findUnique({
      where: {id},
    });
    if (!existing) {
      throw new NotFoundError();
    }

    // Make sure no active subscriptions are linked to this plan before deleting.
    const activeSubs = await this.prisma.subscription.count({
      where: {planId: id, status: SubscriptionStatus.active},
    });

    if (activeSubs > 0) {
      throw new BadRequestError(
        'Cannot delete plan with active subscriptions.',
      );
    }

    await this.prisma.subscriptionPlan.delete({where: {id}});
    return {success: true};
  }

  async previewUpgrade(
    userId: string,
    targetPlanId: number,
    targetCycle: 'monthly' | 'annually',
    requestedCurrency?: string,
  ) {
    const targetPlan = await this.prisma.subscriptionPlan.findUnique({
      where: {id: targetPlanId},
    });
    if (!targetPlan || !targetPlan.isActive) {
      throw new NotFoundError('Subscription plan not found or inactive');
    }

    const user = await this.prisma.user.findUnique({
      where: {id: userId},
      include: {tenant: true},
    });

    const currency = await this.resolveValidCurrency(
      requestedCurrency,
      user?.tenant?.country,
    );

    const { amount: targetPrice } = await this.resolvePlanPrice(
      targetPlanId,
      currency,
      targetCycle,
    );

    const activeSub = await this.prisma.subscription.findFirst({
      where: {userId, status: SubscriptionStatus.active},
      include: {plan: true},
      orderBy: {createdAt: 'desc'},
    });

    if (!activeSub) {
      return {
        isUpgrade: false,
        isSamePlanAndCycle: false,
        currentPlan: null,
        targetPlan: {
          id: targetPlan.id,
          name: targetPlan.name,
          billingCycle: targetCycle,
          price: targetPrice,
        },
        unusedCredit: 0,
        appliedCredit: 0,
        amountToPay: targetPrice,
        currency,
      };
    }

    // Determine current plan cycle and paid amount
    const lastInvoice = await this.prisma.invoice.findFirst({
      where: {
        userId,
        planId: activeSub.planId,
        type: InvoiceType.SUBSCRIPTION,
        status: InvoiceStatus.PAID,
      },
      orderBy: {createdAt: 'desc'},
      include: {transactions: true},
    });

    const lastTx = lastInvoice?.transactions?.[0];
    const currentCycle: 'monthly' | 'annually' =
      (lastTx?.metadata as any)?.billingCycle ||
      (activeSub.periodEnd &&
      activeSub.periodEnd.getTime() - (activeSub.createdAt?.getTime() || 0) >
        40 * 86400000
        ? 'annually'
        : 'monthly');

    let currentPrice = 0;
    if (activeSub.planId) {
      const resolvedCurrent = await this.resolvePlanPrice(
        activeSub.planId,
        currency,
        currentCycle,
      );
      currentPrice = resolvedCurrent.amount;
    }

    const now = new Date();
    let remainingDays = 0;
    const totalDays = currentCycle === 'annually' ? 365 : 30;
    let unusedCredit = 0;

    if (activeSub.periodEnd && activeSub.periodEnd > now) {
      const remainingMs = Math.max(
        0,
        activeSub.periodEnd.getTime() - now.getTime(),
      );

      // Any started day (whether used for 1 second or 23h59m) counts as consumed today.
      // Therefore, only fully unstarted remaining days are credited.
      const fullDaysRemaining = Math.floor(remainingMs / 86400000);
      remainingDays = Math.max(0, Math.min(totalDays - 1, fullDaysRemaining));
      const ratio = remainingDays / totalDays;
      unusedCredit = Math.round(currentPrice * ratio * 100) / 100;
    }

    const isSamePlanAndCycle =
      activeSub.planId === targetPlan.id && currentCycle === targetCycle;
    const isDowngradeFromAnnual =
      currentCycle === 'annually' && targetCycle === 'monthly';

    const isLowerTier = targetPlan.id < (activeSub.planId || 0);

    const isDowngrade =
      isDowngradeFromAnnual || (isLowerTier && !isSamePlanAndCycle);

    const formattedDate = activeSub.periodEnd
      ? new Date(activeSub.periodEnd).toLocaleDateString('en-GB')
      : 'end of period';
    let downgradeMessage: string | null = null;
    if (isDowngradeFromAnnual) {
      downgradeMessage = `You currently have an active Annual subscription valid until ${formattedDate}. Annual subscriptions cannot be downgraded to monthly mid-cycle.`;
    } else if (isLowerTier && !isSamePlanAndCycle) {
      downgradeMessage = `Downgrading to a lower plan tier is not supported mid-cycle. Your current plan remains fully active until ${formattedDate}.`;
    }

    const amountToPay =
      isSamePlanAndCycle || isDowngrade
        ? 0
        : Math.max(0, Math.round((targetPrice - unusedCredit) * 100) / 100);
    const appliedCredit =
      isSamePlanAndCycle || isDowngrade
        ? 0
        : Math.min(targetPrice, unusedCredit);

    return {
      isUpgrade: !isSamePlanAndCycle && !isDowngrade,
      isSamePlanAndCycle,
      isDowngrade,
      downgradeMessage,
      currentPlan: {
        id: activeSub.planId,
        name: activeSub.plan?.name || 'Current Plan',
        billingCycle: currentCycle,
        pricePaid: currentPrice,
        periodEnd: activeSub.periodEnd,
        remainingDays,
      },
      targetPlan: {
        id: targetPlan.id,
        name: targetPlan.name,
        billingCycle: targetCycle,
        price: targetPrice,
      },
      unusedCredit,
      appliedCredit,
      amountToPay,
      currency,
    };
  }

  async subscribe(userId: string, data: SubscribeDTO) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: {id: data.planId},
    });
    if (!plan || !plan.isActive) {
      throw new NotFoundError('Subscription plan not found or inactive');
    }

    const user = await this.prisma.user.findUnique({
      where: {id: userId},
      include: {tenant: true},
    });

    if (!user || !user.email) {
      throw new BadRequestError(
        'User email is required for subscription payments',
      );
    }

    const country = user.tenant?.country || 'KE';

    // Requirement 2: Server-side validation. If requested currency is not enabled or no active price for plan, use USD.
    const targetCurrency = await this.resolveValidCurrency(data.currency, country);
    const { currency: finalCurrency } = await this.resolvePlanPrice(
      data.planId,
      targetCurrency,
      data.billingCycle,
    );
    const currency = finalCurrency;

    // Check upgrade / active subscription status with full proration
    const preview = await this.previewUpgrade(
      userId,
      data.planId,
      data.billingCycle,
      finalCurrency,
    );

    if (preview.isSamePlanAndCycle) {
      throw new BadRequestError(
        'You are already subscribed to this plan with the same billing cycle.',
      );
    }

    if (preview.isDowngrade) {
      throw new BadRequestError(
        preview.downgradeMessage ||
          'Mid-cycle downgrades are not supported. Your current plan remains active until period end.',
      );
    }

    const amount = preview.amountToPay;
    const isInstantUpgrade = preview.isUpgrade && amount === 0;

    // Handle instant upgrade if unused credit covers full target plan price
    if (isInstantUpgrade) {
      const activeSub = await this.prisma.subscription.findFirst({
        where: {userId, status: SubscriptionStatus.active},
      });

      await this.prisma.$transaction(async (tx) => {
        const zeroInvoice = await tx.invoice.create({
          data: {
            userId,
            tenantId: user.tenant?.id,
            planId: plan.id,
            amount: 0,
            currencyCode: currency,
            type: InvoiceType.SUBSCRIPTION,
            status: InvoiceStatus.PAID,
          },
        });

        const zeroRef = `upgrade_zero_${zeroInvoice.id.substring(0, 8)}_${Date.now()}`;
        await tx.transaction.create({
          data: {
            invoiceId: zeroInvoice.id,
            userId,
            tenantId: user.tenant?.id,
            amount: 0,
            currency,
            gateway: PaymentGateway.MANUAL,
            channel: PaymentChannel.UNKNOWN,
            status: TransactionStatus.SUCCEEDED,
            gatewayReference: zeroRef,
            idempotencyKey: zeroRef,
            grossAmount: 0,
            djNetEarning: 0,
            metadata: {
              isUpgrade: true,
              billingCycle: data.billingCycle,
              appliedCredit: preview.appliedCredit,
              oldPlanId: preview.currentPlan?.id,
            },
          },
        });

        const durationDays = data.billingCycle === 'annually' ? 365 : 30;
        const newPeriodEnd = new Date(Date.now() + durationDays * 86400000);

        if (activeSub) {
          await tx.subscription.update({
            where: {id: activeSub.id},
            data: {
              planId: plan.id,
              status: SubscriptionStatus.active,
              periodEnd: newPeriodEnd,
            },
          });
        } else {
          await tx.subscription.create({
            data: {
              userId,
              planId: plan.id,
              status: SubscriptionStatus.active,
              periodEnd: newPeriodEnd,
            },
          });
        }

        if (user.tenant?.id) {
          await tx.tenant.update({
            where: {id: user.tenant.id},
            data: {
              activePlanId: plan.id,
              subscriptionStatus: SubscriptionStatus.active,
            },
          });
        }
      });

      return {
        success: true,
        url: null,
        isInstantUpgrade: true,
        message: 'Plan upgraded successfully using your remaining balance!',
      };
    }

    // Requirement 3: Use simple config map (not hardcoded in service logic).
    // KES -> Paystack. Other currencies -> Flutterwave / Pesapal.
    const provider = PaymentProviderResolver.resolveByCurrency(
      currency,
      data.gateway,
    );

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
      },
    });

    const reference = `sub_${invoice.id.substring(0, 8)}_${Date.now()}`;
    const callbackUrl =
      data.successUrl ||
      `${config.clientUrl}/dashboard/billing?success=true&reference=${reference}`;
    const cancelUrl =
      data.cancelUrl ||
      `${config.clientUrl}/dashboard/billing?canceled=true&reference=${reference}`;

    const paymentDescription = preview.isUpgrade
      ? `UpBeat Upgrade: ${plan.name} (${data.billingCycle}) - Prorated (Credit: ${currency} ${preview.appliedCredit})`
      : `UpBeat Subscription: ${plan.name} (${data.billingCycle})`;

    const paymentResult = await provider.initializePayment({
      reference,
      amount,
      currency,
      email: user.email,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'DJ',
      description: paymentDescription,
      callbackUrl,
      cancelUrl,
      paymentType: 'SUBSCRIPTION',
      country,
      metadata: {
        userId,
        planId: String(plan.id),
        billingCycle: data.billingCycle,
        invoiceId: invoice.id,
        isUpgrade: preview.isUpgrade,
        appliedCredit: preview.appliedCredit,
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
          isUpgrade: preview.isUpgrade,
          appliedCredit: preview.appliedCredit,
        },
      },
    });

    return {
      url: paymentResult.checkoutUrl,
      isUpgrade: preview.isUpgrade,
      appliedCredit: preview.appliedCredit,
      amountToPay: amount,
    };
  }

  getAvailableGateways(country?: string) {
    const c = (country || '').trim().toLowerCase();
    const isEastAfrica = [
      'tanzania',
      'tz',
      'kenya',
      'ke',
      'uganda',
      'ug',
      'rwanda',
      'rw',
    ].includes(c);

    if (isEastAfrica) {
      return [
        {
          id: 'pesapal',
          name: 'Pesapal',
          title: 'Pesapal Mobile Money & Cards (East Africa)',
          description: 'M-Pesa, Tigo Pesa, Airtel Money, Visa & Mastercard',
          currencies: ['TZS', 'KES', 'UGX', 'RWF', 'USD'],
          isRecommended: true,
          badge: 'Recommended for East Africa',
          paymentMethods: ['M-Pesa', 'Tigo Pesa', 'Airtel Money', 'Cards'],
        },
        {
          id: 'paystack',
          name: 'Paystack',
          title: 'Direct Card & Bank Checkout',
          description:
            'Visa, Mastercard, Verve and direct international checkout',
          currencies: ['KES'],
          isRecommended: false,
          badge: 'Debit / Credit Cards',
          paymentMethods: ['Cards', 'Bank Transfer', 'Apple Pay'],
        },
        {
          id: 'flutterwave',
          name: 'Flutterwave',
          title: 'Flutterwave Pan-African',
          description: 'Cards, Mobile Money & Bank Transfer',
          currencies: ['KES', 'UGX', 'TZS', 'RWF', 'USD'],
          isRecommended: false,
          badge: 'Cards & Mobile Money',
          paymentMethods: ['Mobile Money', 'Cards', 'Bank Transfer'],
        },
      ];
    }

    return [
      {
        id: 'flutterwave',
        name: 'Flutterwave',
        title: 'Flutterwave Pan-African',
        description: 'Cards, Mobile Money (MTN/Vodafone/M-Pesa), Bank Transfer',
        currencies: ['GHS', 'NGN', 'ZAR', 'USD', 'KES', 'TZS', 'UGX'],
        isRecommended: true,
        badge: 'Recommended for West & Southern Africa',
        paymentMethods: ['Mobile Money', 'Cards', 'Bank Transfer', 'Apple Pay'],
      },
      {
        id: 'paystack',
        name: 'Paystack',
        title: 'Paystack Payment Gateway',
        description: 'Cards, Bank Transfer & Apple Pay',
        currencies: ['KES'],
        isRecommended: false,
        badge: 'Card Checkout',
        paymentMethods: ['Cards', 'Bank Transfer', 'Apple Pay'],
      },
      {
        id: 'pesapal',
        name: 'Pesapal',
        title: 'Pesapal Mobile Money & Cards',
        description: 'M-Pesa, Airtel Money, Visa & Mastercard',
        currencies: ['KES', 'TZS', 'UGX', 'USD', 'RWF'],
        isRecommended: false,
        badge: 'East Africa / Mobile Money',
        paymentMethods: ['M-Pesa', 'Airtel Money', 'Cards'],
      },
    ];
  }

  async validatePayoutAccount(data: {
    gateway: string;
    bankCode?: string;
    accountNumber: string;
    country?: string;
  }) {
    const gateway = (data.gateway || '').toLowerCase();
    const {bankCode, accountNumber, country} = data;

    if (!accountNumber || !accountNumber.trim()) {
      return {valid: false, message: 'Account or phone number is required.'};
    }

    if (gateway === 'paystack') {
      if (!bankCode) {
        return {
          valid: false,
          message:
            'Bank selection is required for Paystack account verification.',
        };
      }
      const secretKey = process.env.PAYSTACK_SECRET_KEY;
      if (!secretKey) {
        return {valid: true, accountName: 'Test Verified Account (Dev Mode)'};
      }

      try {
        const response = await axios.get(
          `https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(accountNumber.trim())}&bank_code=${encodeURIComponent(bankCode.trim())}`,
          {
            headers: {
              Authorization: `Bearer ${secretKey}`,
            },
          },
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
            message:
              response.data?.message ||
              'Could not verify account name with bank.',
          };
        }
      } catch (err: any) {
        const errMsg =
          err.response?.data?.message || 'Invalid account number or bank code.';
        return {valid: false, message: errMsg};
      }
    }

    // Pesapal / East Africa Mobile Money format validation
    const cleaned = accountNumber.replace(/[\s-+]/g, '');
    const isDigitsOnly = /^\d+$/.test(cleaned);
    if (!isDigitsOnly || cleaned.length < 9 || cleaned.length > 13) {
      return {
        valid: false,
        message:
          'Invalid phone number. Mobile money numbers must be 9 to 12 digits (e.g. 0712345678).',
      };
    }

    return {
      valid: true,
      accountName: 'Verified Mobile Money Account',
    };
  }

  async cancelSubscription(_userId: string) {
    throw new BadRequestError(
      'Subscription cancellation is disabled. Subscriptions are prepaid and remain active for their full paid duration without auto-renewal.',
    );
  }

  // --- Multi-Currency Admin & Public Price Management ---

  async getCurrencies() {
    return this.prisma.currency.findMany({
      orderBy: [{ isActive: 'desc' }, { code: 'asc' }],
    });
  }

  async getPlanPrices(planId: number) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });
    if (!plan) throw new NotFoundError('Subscription plan not found');

    return this.prisma.subscriptionPlanPrice.findMany({
      where: { planId },
      orderBy: { currencyCode: 'asc' },
    });
  }

  async setPlanPrice(planId: number, currencyCode: string, data: SetPlanPriceDTO) {
    const plan = await this.prisma.subscriptionPlan.findUnique({
      where: { id: planId },
    });
    if (!plan) throw new NotFoundError('Subscription plan not found');

    const code = currencyCode.trim().toUpperCase();
    return this.prisma.subscriptionPlanPrice.upsert({
      where: {
        planId_currencyCode: {
          planId,
          currencyCode: code,
        },
      },
      update: {
        priceMonthly: data.priceMonthly,
        priceAnnually: data.priceAnnually,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
      create: {
        planId,
        currencyCode: code,
        priceMonthly: data.priceMonthly,
        priceAnnually: data.priceAnnually,
        isActive: data.isActive !== undefined ? data.isActive : true,
      },
    });
  }

  async toggleCurrency(code: string, isActive: boolean) {
    const upperCode = code.trim().toUpperCase();
    const existing = await this.prisma.currency.findUnique({
      where: { code: upperCode },
    });
    if (!existing) throw new NotFoundError(`Currency ${upperCode} not found`);

    return this.prisma.currency.update({
      where: { code: upperCode },
      data: { isActive },
    });
  }

  async verifyPayment(params: {
    userId: string;
    orderTrackingId?: string;
    reference?: string;
  }) {
    const { WebhookServices } = await import('@/Modules/Webhook/webhook.service');
    const webhookService = new WebhookServices(this.prisma, this.emailProvider);

    if (params.orderTrackingId) {
      return await webhookService.handlePesapalIPN(params.orderTrackingId, params.reference);
    }

    if (!params.reference) {
      throw new BadRequestError('Either orderTrackingId or reference is required for payment verification');
    }

    const tx = await this.prisma.transaction.findFirst({
      where: {
        OR: [
          { gatewayReference: params.reference },
          { idempotencyKey: params.reference },
        ],
      },
    });

    const gateway = tx?.gateway || PaymentGateway.PAYSTACK;
    const provider = PaymentProviderResolver.getGatewayProvider(gateway);
    const verification = await provider.verifyPayment(params.reference);

    if (!verification.isSuccessful || verification.status !== 'PAID') {
      return { success: false, status: verification.status, message: 'Payment pending or not completed' };
    }

    await webhookService.processPaymentSuccess({
      reference: verification.reference || params.reference,
      gateway,
      gatewayEventId: `verify_${params.reference}_${Date.now()}`,
      amountPaid: verification.amount,
      currency: verification.currency,
      paidAt: verification.paidAt,
      channel: verification.channel,
      metadata: verification.metadata,
      rawPayload: { verification, source: 'client_redirect_verify' },
    });

    return { success: true, status: 'PAID' };
  }
}
