import Stripe from "stripe";
import { PrismaClient } from '@/prisma/generated/client';
import { config } from "@/core/config";

const stripe = new Stripe(config.stripe.secretKey || process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2024-04-10" as any,
});

export class StripeConnectService {
  constructor(private prisma: PrismaClient) { }

  public async getOnboardingLink(tenantId: string, refreshUrl: string, returnUrl: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { user: true },
    });

    if (!tenant) throw new Error("Tenant not found");

    let accountId = tenant.stripeAccountId;

    // Create a new Stripe Connected Account if they don't have one
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: "express",
        email: tenant.user?.email,
        capabilities: {
          transfers: { requested: true },
        },
      });
      accountId = account.id;

      // Save the account ID to the tenant
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { stripeAccountId: accountId },
      });
    }

    // Create an onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: refreshUrl,
      return_url: returnUrl,
      type: "account_onboarding",
    });

    return {
      url: accountLink.url,
      stripeAccountId: accountId,
    };
  }

  public async checkAccountStatus(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant || !tenant.stripeAccountId) {
      return { isConnected: false, detailsSubmitted: false };
    }

    const account = await stripe.accounts.retrieve(tenant.stripeAccountId);
    
    let externalAccount = null;
    if (account.external_accounts?.data?.length) {
      const extAcc = account.external_accounts.data[0] as any;
      if (extAcc.object === 'bank_account') {
        externalAccount = { type: 'bank_account', last4: extAcc.last4, bankName: extAcc.bank_name };
      } else if (extAcc.object === 'card') {
        externalAccount = { type: 'card', last4: extAcc.last4, brand: extAcc.brand };
      }
    }

    return {
      isConnected: true,
      detailsSubmitted: account.details_submitted,
      payoutsEnabled: account.payouts_enabled,
      externalAccount
    };
  }
}
