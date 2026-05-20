// src/Modules/Tenant/tenant.controller.ts
import { Request, Response } from "express";
import { BaseController } from "@/core/BaseController";
import { AppLogger } from "@/core/logging/logger";
import { TenantServices } from "./tenant.service";
import { CreateTenantDTO, UpdateTenantDTO, AssignThemeDTO } from "./TenantDTO";

export class TenantController extends BaseController {
  private logger = new AppLogger("TenantController");

  constructor(private readonly tenantService: TenantServices) {
    super();
  }

  public async onboard(req: Request, res: Response) {
    const data = req.validatedBody as CreateTenantDTO;
    
    // User is extracted from authenticateUser middleware
    const userId = req.user!.id; 

    const newTenant = await this.tenantService.createTenant(userId, data);

    return this.sendCreatedResponse(req, res, newTenant, "Tenant profile created successfully");
  }

  public async getAllTenants(req: Request, res: Response) {
    const { tenants, meta } = await this.tenantService.getAllTenants(req.query as Record<string, unknown>);

    return this.sendPaginatedResponse(req, res, meta, "Tenants retrieved successfully", tenants);
  }

  public async getPublicProfile(req: Request, res: Response) {
    const subdomain = req.params.subdomain as string;

    const tenant = await this.tenantService.getTenantBySubdomain(subdomain);

    return this.sendResponse(req, res, "Tenant profile retrieved successfully", 200, tenant);
  }

  public async updateProfile(req: Request, res: Response) {
    const data = req.validatedBody as UpdateTenantDTO;
    const userId = req.user!.id;

    const updatedTenant = await this.tenantService.updateTenantProfile(userId, data);

    return this.sendResponse(req, res, "Tenant profile updated successfully", 200, updatedTenant);
  }

  public async assignTheme(req: Request, res: Response) {
    const { themeId } = req.validatedBody as AssignThemeDTO;
    const userId = req.user!.id;

    const updatedTenant = await this.tenantService.assignTheme(userId, themeId);

    return this.sendResponse(req, res, "Theme assigned successfully", 200, updatedTenant);
  }
}
