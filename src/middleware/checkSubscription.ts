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

      // 1. First, check if there is an actual active subscription
      const activeSub = await prisma.subscription.findFirst({
        where: { userId: user.id, status: 'active' },
        orderBy: { createdAt: 'desc' }
      });

      // 2. If no active sub exists, but tenant says active, heal it to canceled
      if (!activeSub) {
        if (tenant.subscriptionStatus === 'active') {
          await prisma.tenant.update({
            where: { id: tenant.id },
            data: { subscriptionStatus: 'canceled' }
          });
        }
        throw new AuthorizationError('Subscription is inactive or expired. Please renew your subscription to access this feature.');
      }

      // 3. If active sub exists, but tenant says otherwise, heal it to active
      if (tenant.subscriptionStatus !== 'active') {
        await prisma.tenant.update({
          where: { id: tenant.id },
          data: { 
            subscriptionStatus: 'active', 
            activePlanId: activeSub.planId 
          }
        });
        tenant.subscriptionStatus = 'active';
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
