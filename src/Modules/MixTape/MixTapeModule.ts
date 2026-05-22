import { BaseModule } from "@/core/BaseModule";
import { AppLogger } from "@/core/logging/logger";
import { MixTapeServices } from "./mixtape.service";
import { MixTapeController } from "./mixtape.controller";
import { validateRequest } from "@/middleware/validation";
import { authenticateUser, authorizeRole } from "@/middleware/auth";
import { UserRole } from "@/prisma/generated/client";
import { IFileUploader } from "@/utils/IFileUploader";
import multer from "multer";
import {
  createMixTapeSchema,
  updateMixTapeSchema,
  reorderMixTapesSchema,
} from "./MixTapeDTO";

export class MixTapeModule extends BaseModule {
  public name: string = "MixTapeModule";
  public version: string = "1.0.0";
  public basePath: string = "/mixtapes/v1/";
  public dependencies?: string[] | undefined;

  private logger = new AppLogger("MixTapeModule");

  protected async setupUseCases(): Promise<void> {
    const prisma = this.context.getService("prisma");
    const fileUploader = this.context.getService("fileUploader") as IFileUploader;
    this.registerService("MixTapeService", new MixTapeServices(prisma, fileUploader));
  }

  protected async setupControllers(): Promise<void> {
    const mixTapeService = this.getService<MixTapeServices>("MixTapeService");
    this.registerController("MixTapeController", new MixTapeController(mixTapeService));
  }

  protected async setupRoutes(): Promise<void> {
    const controller = this.getController<MixTapeController>("MixTapeController");
    const upload = multer({ dest: 'tmp/' });

    // Public Routes
    this.router.get(
      "/tenant/:tenantId",
      controller.getTenantMixTapes.bind(controller),
    );

    // DJ Routes
    this.router.post(
      "/",
      authenticateUser,
      authorizeRole([UserRole.DJ]),
      upload.single('coverImage'),
      validateRequest(createMixTapeSchema),
      controller.createMixTape.bind(controller),
    );

    this.router.patch(
      "/:id",
      authenticateUser,
      authorizeRole([UserRole.DJ]),
      upload.single('coverImage'),
      validateRequest(updateMixTapeSchema),
      controller.updateMixTape.bind(controller),
    );

    this.router.delete(
      "/:id",
      authenticateUser,
      authorizeRole([UserRole.DJ]),
      controller.deleteMixTape.bind(controller),
    );

    this.router.post(
      "/reorder",
      authenticateUser,
      authorizeRole([UserRole.DJ]),
      validateRequest(reorderMixTapesSchema),
      controller.reorderMixTapes.bind(controller),
    );
  }
}
