import { Request, Response, NextFunction } from 'express';
import { AnalyticsServices } from './analytics.service';
import { BaseController } from '@/core/BaseController';

export class AnalyticsController extends BaseController {
  constructor(private analyticsServices: AnalyticsServices) {
    super();
  }

  getAdminAnalytics = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.analyticsServices.getAdminAnalytics();
      return this.sendResponse(req, res, 'Admin analytics retrieved successfully', 200, result);
    } catch (error) {
      next(error);
    }
  };

  getTenantAnalytics = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user.id;
      const result = await this.analyticsServices.getTenantAnalytics(userId);
      return this.sendResponse(req, res, 'Tenant analytics retrieved successfully', 200, result);
    } catch (error) {
      next(error);
    }
  };

  getAdminCharts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.analyticsServices.getAdminCharts();
      return this.sendResponse(req, res, 'Admin charts retrieved successfully', 200, result);
    } catch (error) {
      next(error);
    }
  };

  getTenantCharts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user.id;
      const result = await this.analyticsServices.getTenantCharts(userId);
      return this.sendResponse(req, res, 'Tenant charts retrieved successfully', 200, result);
    } catch (error) {
      next(error);
    }
  };
}
