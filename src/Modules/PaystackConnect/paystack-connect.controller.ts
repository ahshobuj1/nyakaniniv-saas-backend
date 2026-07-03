import { Request, Response } from 'express';
import { BaseController } from '@/core/BaseController';
import { PaystackConnectService } from './paystack-connect.service';

export class PaystackConnectController extends BaseController {
  constructor(private paystackConnectService: PaystackConnectService) {
    super();
  }

  public async onboard(req: Request, res: Response): Promise<void> {
    const { tenantId, bankCode, accountNumber, businessName } = req.body;

    if (!tenantId || !bankCode || !accountNumber || !businessName) {
      throw new Error('Missing required fields for Paystack onboarding');
    }

    const result = await this.paystackConnectService.createSubaccount(tenantId, bankCode, accountNumber, businessName);
    this.sendResponse(req, res, 'Paystack onboarding initiated', 200, result);
  }

  public async getStatus(req: Request, res: Response): Promise<void> {
    const tenantId = req.query.tenantId as string;
    
    if (!tenantId) {
      throw new Error('tenantId query parameter is required');
    }

    const result = await this.paystackConnectService.checkAccountStatus(tenantId);
    this.sendResponse(req, res, 'Paystack connection status retrieved', 200, result);
  }
}
