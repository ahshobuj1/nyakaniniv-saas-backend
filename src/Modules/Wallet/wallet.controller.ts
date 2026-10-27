import {Request, Response} from 'express';
import {BaseController} from '@/core/BaseController';
import {WalletService} from './wallet.service';

export class WalletController extends BaseController {
  constructor(private walletService: WalletService) {
    super();
  }

  public async getWallet(req: Request, res: Response): Promise<void> {
    const tenantId =
      (req.query.tenantId as string) || (req.user as any)?.tenant?.id;

    if (!tenantId) {
      throw new Error('tenantId is required');
    }

    const data = await this.walletService.getWallet(tenantId);
    this.sendResponse(req, res, 'Wallet retrieved successfully', 200, data);
  }

  public async withdraw(req: Request, res: Response): Promise<void> {
    const tenantId =
      (req.body.tenantId as string) || (req.user as any)?.tenant?.id;
    const {amount} = req.body;

    if (!tenantId) {
      throw new Error('tenantId is required');
    }

    if (!amount || Number(amount) <= 0) {
      throw new Error('Valid withdrawal amount is required');
    }

    const result = await this.walletService.requestWithdrawal(
      tenantId,
      Number(amount),
    );
    this.sendResponse(
      req,
      res,
      'Withdrawal request submitted successfully',
      201,
      result,
    );
  }

  public async previewBreakdown(req: Request, res: Response): Promise<void> {
    const amount = Number(req.query.amount) || 0;
    const userTenant = (req.user as any)?.tenant;
    const currency =
      (req.query.currency as string) || userTenant?.currencyCode || 'USD';
    const country =
      (req.query.country as string) || userTenant?.country || 'KE';

    const {calculateFinancialBreakdown} =
      await import('@/core/config/financial-matrix.config');
    const breakdown = calculateFinancialBreakdown(
      amount,
      currency,
      null,
      country,
    );
    this.sendResponse(
      req,
      res,
      'Fee breakdown calculated successfully',
      200,
      breakdown,
    );
  }
}
