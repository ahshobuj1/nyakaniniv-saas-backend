import { BaseModule } from "@/core/BaseModule";
import { AppLogger } from "@/core/logging/logger";
import { ThemeServices } from "./theme.service";
import { ThemeController } from "./theme.controller";
import { validateRequest } from "@/middleware/validation";
import { authenticateUser, authorizeRole } from "@/middleware/auth";
import { UserRole } from "@/prisma/generated/client";
import { IFileUploader } from "@/utils/IFileUploader";
import multer from "multer";
import {
  createThemeSchema,
  updateThemeSchema,
} from "./ThemeDTO";

export class ThemeModule extends BaseModule {
  public name: string = "ThemeModule";
  public version: string = "1.0.0";
  public basePath: string = "/themes/v1/";
  public dependencies?: string[] | undefined;

  private logger = new AppLogger("ThemeModule");

  protected async setupUseCases(): Promise<void> {
    const prisma = this.context.getService("prisma");
    this.registerService("ThemeService", new ThemeServices(prisma));
  }

  protected async setupControllers(): Promise<void> {
    const themeService = this.getService<ThemeServices>("ThemeService");
    const fileUploader = this.context.getService("fileUploader") as IFileUploader;
    this.registerController("ThemeController", new ThemeController(themeService, fileUploader));
  }

  protected async setupRoutes(): Promise<void> {
    const controller = this.getController<ThemeController>("ThemeController");

    // Public Routes
    this.router.get(
      "/",
      controller.getAllThemes.bind(controller),
    );

    this.router.get(
      "/slug/:slug",
      controller.getThemeBySlug.bind(controller),
    );

    const upload = multer({ dest: 'tmp/' });

    // Middleware to parse 'data' field from form-data if the client sends a JSON string
    const parseFormDataJson = (req: any, res: any, next: any) => {
      if (req.body && req.body.data && typeof req.body.data === 'string') {
        try {
          const parsed = JSON.parse(req.body.data);
          req.body = { ...req.body, ...parsed };
        } catch (e) {
          // If it fails to parse, just continue and let Zod handle validation errors
        }
      }
      next();
    };

    // Admin Routes
    this.router.post(
      "/",
      authenticateUser,
      authorizeRole([UserRole.SUPER_ADMIN, UserRole.DJ]),
      upload.single('previewImage'),
      parseFormDataJson,
      validateRequest(createThemeSchema),
      controller.createTheme.bind(controller),
    );

    this.router.patch(
      "/:id",
      authenticateUser,
      authorizeRole([UserRole.SUPER_ADMIN, UserRole.DJ]),
      upload.single('previewImage'),
      parseFormDataJson,
      validateRequest(updateThemeSchema),
      controller.updateTheme.bind(controller),
    );

    this.router.delete(
      "/:id",
      authenticateUser,
      authorizeRole([UserRole.SUPER_ADMIN, UserRole.DJ]),
      controller.deleteTheme.bind(controller),
    );
  }
}
