import { Request, Response } from "express";
import { StripeConnectService } from "./stripe-connect.service";
import { BaseController } from "@/core/BaseController";

export class StripeConnectController extends BaseController {
  constructor(private stripeConnectService: StripeConnectService) {
    super();
  }

  public async getOnboardingLink(req: Request, res: Response) {
    // Assuming the authenticateUser middleware adds `user` to `req`
    const userId = (req as any).user?.id;
    if (!userId) {
      throw new Error("User not authenticated");
    }

    const tenantId = (req as any).user?.tenant?.id || req.body.tenantId;

    if (!tenantId) {
      throw new Error("Tenant ID is required. Make sure you have a tenant.");
    }

    const refreshUrl = req.body.refreshUrl || `${req.protocol}://${req.get("host")}/api/v1/stripe-connect/refresh`;
    const returnUrl = req.body.returnUrl || `${req.protocol}://${req.get("host")}/api/v1/stripe-connect/return`;

    const result = await this.stripeConnectService.getOnboardingLink(tenantId, refreshUrl, returnUrl);

    return this.sendResponse(
      req,
      res,
      "Stripe Connect onboarding link generated successfully",
      200,
      result
    );
  }

  public async checkStatus(req: Request, res: Response) {
    const tenantId = (req as any).user?.tenant?.id || req.query.tenantId;
    if (!tenantId) {
      throw new Error("Tenant ID is required.");
    }

    const status = await this.stripeConnectService.checkAccountStatus(tenantId as string);

    return this.sendResponse(
      req,
      res,
      "Stripe Connect status retrieved",
      200,
      status
    );
  }
}
