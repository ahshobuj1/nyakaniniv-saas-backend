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
    const plans = await this.subscriptionService.getAllPlans();
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

  public async handleWebhook(req: Request, res: Response): Promise<void> {
    const signature = req.headers['stripe-signature'] as string;

    // Express raw body required here, assumes middleware is setup for '/webhook' 
    // to provide raw body in req.body or similar, but for simplicity:
    const rawBody = (req as any).rawBody || req.body;

    const result = await this.subscriptionService.handleStripeWebhook(signature, rawBody);
    this.sendResponse(req, res, undefined, undefined, result);
  }
}
