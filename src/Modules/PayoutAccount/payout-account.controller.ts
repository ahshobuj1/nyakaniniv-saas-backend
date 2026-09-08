import { Request, Response } from 'express';
import { BaseController } from '@/core/BaseController';
import { PaystackConnectService } from './payout-account.service';

export class PaystackConnectController extends BaseController {
  constructor(private paystackConnectService: PaystackConnectService) {
    super();
  }

  public async onboard(req: Request, res: Response): Promise<void> {
    const { tenantId, bankCode, accountNumber, businessName, country, gateway, bankName } = req.body;

    if (!tenantId || !bankCode || !accountNumber || !businessName) {
      throw new Error('Missing required fields for onboarding');
    }

    const result = await this.paystackConnectService.createSubaccount(
      tenantId,
      bankCode,
      accountNumber,
      businessName,
      country,
      gateway,
      bankName
    );
    this.sendResponse(req, res, 'Payout account onboarded successfully', 200, result);
  }

  public async getStatus(req: Request, res: Response): Promise<void> {
    const tenantId = req.query.tenantId as string;
    
    if (!tenantId) {
      throw new Error('tenantId query parameter is required');
    }

    const result = await this.paystackConnectService.checkAccountStatus(tenantId);
    this.sendResponse(req, res, 'Paystack connection status retrieved', 200, result);
  }

  public async getBanks(req: Request, res: Response): Promise<void> {
    const country = req.query.country as string || 'nigeria';
    const gateway = req.query.gateway as string;
    const banks = await this.paystackConnectService.getBanks(country, gateway);
    this.sendResponse(req, res, 'Banks retrieved successfully', 200, banks);
  }

  public async disconnect(req: Request, res: Response): Promise<void> {
    const tenantId = req.body?.tenantId || (req.query?.tenantId as string) || (req.user as any)?.tenant?.id;
    
    if (!tenantId) {
      throw new Error('tenantId is required');
    }

    const result = await this.paystackConnectService.disconnectAccount(tenantId);
    this.sendResponse(req, res, 'Payout account disconnected', 200, result);
  }

  public async validate(req: Request, res: Response): Promise<void> {
    const { bankCode, accountNumber, country, gateway } = req.body;
    if (!bankCode || !accountNumber) {
      throw new Error('bankCode and accountNumber are required');
    }
    const result = await this.paystackConnectService.validateAccount(bankCode, accountNumber, country, gateway);
    this.sendResponse(req, res, result.valid ? 'Account verified' : (result.message || 'Verification failed'), 200, result);
  }

  public async getConnectOAuthUrl(req: Request, res: Response): Promise<void> {
    const tenantId = (req.query.tenantId as string) || (req.user as any)?.tenant?.id;
    if (!tenantId) {
      throw new Error('tenantId is required');
    }
    const result = await this.paystackConnectService.getConnectOAuthUrl(tenantId);
    this.sendResponse(req, res, 'Paystack OAuth URL generated', 200, result);
  }

  public async handleOAuthCallback(req: Request, res: Response): Promise<void> {
    const code = req.query.code as string;
    const state = req.query.state as string; // tenantId
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

    if (!code || !state) {
      res.redirect(`${frontendUrl}/dashboard/billing?error=missing_oauth_params`);
      return;
    }

    try {
      await this.paystackConnectService.handleOAuthCallback(code, state);
      res.redirect(`${frontendUrl}/dashboard/billing?paystack_connected=true`);
    } catch (error: any) {
      res.redirect(`${frontendUrl}/dashboard/billing?error=${encodeURIComponent(error.message || 'connection_failed')}`);
    }
  }
}
