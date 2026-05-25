import { PrismaClient } from '@/prisma/generated/client';

export class AccessControlService {
  /**
   * Check if a tenant has access to a specific feature based on their active subscription plan.
   * @param tenant The tenant object (must include activePlanId and subscriptionStatus)
   * @param feature The feature to check for (e.g., 'ONLINE_PAYMENTS')
   * @param prisma PrismaClient instance
   * @returns boolean
   */
  static async hasFeature(tenant: any, feature: string, prisma: PrismaClient): Promise<boolean> {
    if (!tenant || !tenant.activePlanId) {
      return false;
    }

    if (tenant.subscriptionStatus !== 'active') {
      return false; // Or handle grace periods if needed
    }

    const plan = await prisma.subscriptionPlan.findUnique({
      where: { id: tenant.activePlanId }
    });

    if (!plan || !plan.features) {
      return false;
    }

    const features = plan.features as string[];
    return features.includes(feature);
  }
}
