import { Request, Response } from 'express';
import { BaseController } from '@/core/BaseController';
import { SubscriptionServices } from './subscription.service';
import { UserRole } from '@/prisma/generated/client';

export class SubscriptionController extends BaseController {
  constructor(private subscriptionService: SubscriptionServices) {
    super();
  }

  public async createPlan(req: Request, res: Response): Promise<void> {
    const plan = await this.subscriptionService.createPlan(req.body);
    this.sendCreatedResponse(req, res, plan, 'Subscription plan created successfully');
  }

  public async getAllPlans(req: Request, res: Response): Promise<void> {
    const all = req.query.all === 'true';
    const plans = await this.subscriptionService.getAllPlans(all);
    this.sendResponse(req, res, 'Plans retrieved successfully', undefined, plans);
  }

  public async getMySubscription(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const subscription = await this.subscriptionService.getMySubscription(userId);
    this.sendResponse(req, res, 'Active subscription retrieved successfully', undefined, subscription);
  }

  public async updatePlan(req: Request, res: Response): Promise<void> {
    const id = parseInt(String(req.params.id), 10);
    const plan = await this.subscriptionService.updatePlan(id, req.body);
    this.sendResponse(req, res, 'Plan updated successfully', undefined, plan);
  }

  public async deletePlan(req: Request, res: Response): Promise<void> {
    const id = parseInt(String(req.params.id), 10);
    await this.subscriptionService.deletePlan(id);
    this.sendResponse(req, res, 'Plan deleted successfully', undefined, null);
  }

  public async subscribe(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const result = await this.subscriptionService.subscribe(userId, req.body);
    this.sendResponse(req, res, 'Subscription process initiated', undefined, result);
  }

  public async cancelSubscription(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const result = await this.subscriptionService.cancelSubscription(userId);
    this.sendResponse(req, res, 'Subscription canceled successfully', undefined, result);
  }

  public async getAvailableGateways(req: Request, res: Response): Promise<void> {
    const country = (req.query.country as string) || (req.user as any)?.country;
    const gateways = this.subscriptionService.getAvailableGateways(country);
    this.sendResponse(req, res, 'Available gateways retrieved successfully', undefined, gateways);
  }

  public async validatePayout(req: Request, res: Response): Promise<void> {
    const result = await this.subscriptionService.validatePayoutAccount(req.body);
    this.sendResponse(req, res, result.valid ? 'Account validated' : (result.message || 'Validation failed'), undefined, result);
  }
}
