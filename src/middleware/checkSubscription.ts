import { Request, Response, NextFunction } from 'express';
import { AuthorizationError, NotFoundError } from '@/core/errors/AppError';
import { AccessControlService } from '@/Modules/Subscription/AccessControlService';
import { prisma } from '@/lib/prisma';

/**
 * Middleware to check if a tenant's subscription is active and optionally has specific features.
 * 
 * Usage:
 * router.get('/protected-route', checkSubscription(), controller.handler);
 * router.post('/payments', checkSubscription(['ONLINE_PAYMENTS']), controller.handler);
 * 
 * @param requiredFeatures Array of feature strings that the tenant must have (optional)
 */
export const checkSubscription = (requiredFeatures: string[] = []) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Typically the tenantId should be in req.user (from auth middleware) or req.tenant (from subdomain middleware)
      const user = (req as any).user;

      if (!user) {
        throw new AuthorizationError('User not authenticated.');
      }

      // Find the tenant associated with this user
      const tenant = await prisma.tenant.findUnique({
        where: { userId: user.id }
      });

      if (!tenant) {
        throw new NotFoundError('Tenant profile not found for this user.');
      }

      // 1. First, check if there is an active or grace period subscription
      const sub = await prisma.subscription.findFirst({
        where: {
          userId: user.id,
          status: { in: ['active', 'past_due'] },
        },
        orderBy: { createdAt: 'desc' }
      });

      const now = new Date();
      const GRACE_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;
      const isSubValid = Boolean(
        sub &&
        sub.periodEnd &&
        (new Date(sub.periodEnd) > now || now.getTime() <= new Date(sub.periodEnd).getTime() + GRACE_PERIOD_MS)
      );

      // 2. If no valid active or grace sub exists, heal tenant to canceled and throw error
      if (!isSubValid || !sub) {
        if (tenant.subscriptionStatus === 'active' || tenant.subscriptionStatus === 'past_due') {
          await prisma.tenant.update({
            where: { id: tenant.id },
            data: { subscriptionStatus: 'canceled' }
          });
        }
        throw new AuthorizationError('Subscription is inactive or expired. Please renew your subscription to access this feature.');
      }

      // 3. Keep tenant subscription status synchronized with the active/past_due sub
      const expectedStatus = sub.status === 'past_due' ? 'past_due' : 'active';
      if (tenant.subscriptionStatus !== expectedStatus || tenant.activePlanId !== sub.planId) {
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: { 
            subscriptionStatus: expectedStatus, 
            activePlanId: sub.planId 
          }
        });
        tenant.subscriptionStatus = expectedStatus;
      }

      // If required features are specified, verify them
      if (requiredFeatures.length > 0) {
        for (const feature of requiredFeatures) {
          const hasFeature = await AccessControlService.hasFeature(tenant, feature, prisma);
          if (!hasFeature) {
            throw new AuthorizationError(`Your current plan does not support the '${feature}' feature. Please upgrade your plan.`);
          }
        }
      }

      // Inject tenant into request for downstream use if not already present
      if (!(req as any).tenant) {
        (req as any).tenant = tenant;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
