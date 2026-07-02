// src/Modules/Tenant/TenantModule.ts
import {BaseModule} from '@/core/BaseModule';
import {AppLogger} from '@/core/logging/logger';
import {TenantServices} from './tenant.service';
import {TenantController} from './tenant.controller';
import {validateRequest} from '@/middleware/validation';
import {authenticateUser, authorizeRole} from '@/middleware/auth';
import {
  createTenantSchema,
  updateTenantSchema,
  assignThemeSchema,
  updateTenantStatusSchema,
} from './TenantDTO';
import {UserRole} from '@/prisma/generated/client';
import { IFileUploader } from '@/utils/IFileUploader';
import multer from 'multer';

export class TenantModule extends BaseModule {
  public name: string = 'TenantModule';
  public version: string = '1.0.0';
  public basePath: string = '/tenant/v1/';
  public dependencies?: string[] | undefined;

  private logger = new AppLogger('TenantModule');

  protected async setupUseCases(): Promise<void> {
    const prisma = this.context.getService("prisma");
    const emailProvider = this.context.getService("email");
    this.registerService("TenantService", new TenantServices(prisma, emailProvider));
  }

  protected async setupControllers(): Promise<void> {
    const tenantService = this.getService<TenantServices>('TenantService');
    const fileUploader = this.context.getService('fileUploader') as IFileUploader;
    this.registerController(
      'TenantController',
      new TenantController(tenantService, fileUploader),
    );
  }

  protected async setupRoutes(): Promise<void> {
    const controller = this.getController<TenantController>('TenantController');
    const upload = multer({ dest: 'tmp/' });

    // Upload Media for Themes
    this.router.post(
      '/upload-media',
      authenticateUser,
      upload.single('file'),
      controller.uploadMedia.bind(controller),
    );

    // DJ Onboarding (Create Tenant)
    this.router.post(
      '/onboard',
      authenticateUser,
      validateRequest(createTenantSchema),
      controller.onboard.bind(controller),
    );

    // Get All Tenants (Admin Only)
    this.router.get(
      '/',
      authenticateUser,
      authorizeRole([UserRole.SUPER_ADMIN, UserRole.DJ]),
      controller.getAllTenants.bind(controller),
    );

    // Get Public Profile
    this.router.get(
      '/:subdomain',
      controller.getPublicProfile.bind(controller),
    );

    // Update Profile
    this.router.put(
      '/profile',
      authenticateUser,
      validateRequest(updateTenantSchema),
      controller.updateProfile.bind(controller),
    );

    // Assign Theme
    this.router.put(
      '/theme',
      authenticateUser,
      validateRequest(assignThemeSchema),
      controller.assignTheme.bind(controller),
    );

    // Update Tenant Status (Admin Only)
    this.router.patch(
      '/:id/status',
      authenticateUser,
      authorizeRole([UserRole.SUPER_ADMIN]),
      validateRequest(updateTenantStatusSchema),
      controller.updateTenantStatus.bind(controller),
    );
  }
}
