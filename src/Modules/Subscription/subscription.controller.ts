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
    const currency = req.query.currency as string | undefined;
    const plans = await this.subscriptionService.getAllPlans(currency, all);
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

  public async previewUpgrade(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const planId = parseInt(String(req.query.planId), 10);
    const billingCycle = (req.query.billingCycle as 'monthly' | 'annually') || 'monthly';
    const currency = req.query.currency as string | undefined;
    const preview = await this.subscriptionService.previewUpgrade(userId, planId, billingCycle, currency);
    this.sendResponse(req, res, 'Subscription upgrade preview generated', undefined, preview);
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

  public async getCurrencies(req: Request, res: Response): Promise<void> {
    const currencies = await this.subscriptionService.getCurrencies();
    this.sendResponse(req, res, 'Currencies retrieved successfully', undefined, currencies);
  }

  public async getPlanPrices(req: Request, res: Response): Promise<void> {
    const planId = parseInt(String(req.params.id), 10);
    const prices = await this.subscriptionService.getPlanPrices(planId);
    this.sendResponse(req, res, 'Plan prices retrieved successfully', undefined, prices);
  }

  public async setPlanPrice(req: Request, res: Response): Promise<void> {
    const planId = parseInt(String(req.params.id), 10);
    const currencyCode = String(req.params.currencyCode || req.body.currencyCode || '').trim().toUpperCase();
    const price = await this.subscriptionService.setPlanPrice(planId, currencyCode, req.body);
    this.sendResponse(req, res, 'Plan price updated successfully', undefined, price);
  }

  public async toggleCurrency(req: Request, res: Response): Promise<void> {
    const code = String(req.params.code);
    const currency = await this.subscriptionService.toggleCurrency(code, req.body.isActive);
    this.sendResponse(req, res, 'Currency status updated successfully', undefined, currency);
  }
}
