import { BaseModule } from "@/core/BaseModule";
import { AppLogger } from "@/core/logging/logger";
import { NotificationServices } from "./notification.service";
import { NotificationController } from "./notification.controller";
import { validateRequest } from "@/middleware/validation";
import { authenticateUser, authorizeRole } from "@/middleware/auth";
import { UserRole } from "@/prisma/generated/client";
import {
  createNotificationSchema,
} from "./NotificationDTO";

export class NotificationModule extends BaseModule {
  public name: string = "NotificationModule";
  public version: string = "1.0.0";
  public basePath: string = "/notifications/v1/";
  public dependencies?: string[] | undefined;

  private logger = new AppLogger("NotificationModule");

  protected async setupUseCases(): Promise<void> {
    const prisma = this.context.getService("prisma");
    this.registerService("NotificationService", new NotificationServices(prisma));
  }

  protected async setupControllers(): Promise<void> {
    const notificationService = this.getService<NotificationServices>("NotificationService");
    this.registerController("NotificationController", new NotificationController(notificationService));
  }

  protected async setupRoutes(): Promise<void> {
    const controller = this.getController<NotificationController>("NotificationController");

    // Admin Routes
    this.router.post(
      "/broadcast",
      authenticateUser,
      authorizeRole([UserRole.SUPER_ADMIN]),
      validateRequest(createNotificationSchema),
      controller.broadcast.bind(controller),
    );

    // Authenticated User Routes (DJ or standard user if applicable)
    this.router.get(
      "/my-notifications",
      authenticateUser,
      controller.getMyNotifications.bind(controller),
    );

    this.router.get(
      "/unread-count",
      authenticateUser,
      controller.getUnreadCount.bind(controller),
    );

    this.router.patch(
      "/:id/read",
      authenticateUser,
      controller.markAsRead.bind(controller),
    );
  }
}
