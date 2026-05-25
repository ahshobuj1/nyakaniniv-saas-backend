import { BaseModule } from '@/core/BaseModule';
import { AppLogger } from '@/core/logging/logger';
import { AnalyticsServices } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import { authenticateUser, authorizeRole } from '@/middleware/auth';
import { checkSubscription } from '@/middleware/checkSubscription';
import { UserRole } from '@/prisma/generated/client';

export class AnalyticsModule extends BaseModule {
  public name: string = 'AnalyticsModule';
  public version: string = '1.0.0';
  public basePath: string = '/analytics/v1';
  public dependencies?: string[] | undefined;

  private logger = new AppLogger('AnalyticsModule');

  protected async setupUseCases(): Promise<void> {
    const prisma = this.context.getService('prisma');
    this.registerService('AnalyticsService', new AnalyticsServices(prisma));
  }

  protected async setupControllers(): Promise<void> {
    const analyticsService = this.getService<AnalyticsServices>('AnalyticsService');
    this.registerController('AnalyticsController', new AnalyticsController(analyticsService));
  }

  protected async setupRoutes(): Promise<void> {
    const controller = this.getController<AnalyticsController>('AnalyticsController');

    // Admin analytics route
    this.router.get('/admin', authenticateUser, authorizeRole([UserRole.SUPER_ADMIN]), controller.getAdminAnalytics.bind(controller));

    // Tenant (DJ) analytics route - Requires basic active subscription to view dashboard analytics
    this.router.get('/tenant', authenticateUser, authorizeRole([UserRole.DJ]), checkSubscription(), controller.getTenantAnalytics.bind(controller));
  }
}
