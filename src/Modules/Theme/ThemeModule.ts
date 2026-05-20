import { BaseModule } from "@/core/BaseModule";
import { AppLogger } from "@/core/logging/logger";
import { ThemeServices } from "./theme.service";
import { ThemeController } from "./theme.controller";
import { validateRequest } from "@/middleware/validation";
import { authenticateUser, authorizeRole } from "@/middleware/auth";
import { UserRole } from "@/prisma/generated/client";
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
    this.registerController("ThemeController", new ThemeController(themeService));
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

    // Admin Routes
    this.router.post(
      "/",
      authenticateUser,
      authorizeRole([UserRole.SUPER_ADMIN]),
      validateRequest(createThemeSchema),
      controller.createTheme.bind(controller),
    );

    this.router.patch(
      "/:id",
      authenticateUser,
      authorizeRole([UserRole.SUPER_ADMIN]),
      validateRequest(updateThemeSchema),
      controller.updateTheme.bind(controller),
    );

    this.router.delete(
      "/:id",
      authenticateUser,
      authorizeRole([UserRole.SUPER_ADMIN]),
      controller.deleteTheme.bind(controller),
    );
  }
}
