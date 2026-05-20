import { BaseModule } from "@/core/BaseModule";
import { AppLogger } from "@/core/logging/logger";
import { EventServices } from "./event.service";
import { EventController } from "./event.controller";
import { validateRequest } from "@/middleware/validation";
import { authenticateUser, authorizeRole } from "@/middleware/auth";
import { UserRole } from "@/prisma/generated/client";
import {
  createEventSchema,
  updateEventSchema,
} from "./EventDTO";

export class EventModule extends BaseModule {
  public name: string = "EventModule";
  public version: string = "1.0.0";
  public basePath: string = "/events/v1/";
  public dependencies?: string[] | undefined;

  private logger = new AppLogger("EventModule");

  protected async setupUseCases(): Promise<void> {
    const prisma = this.context.getService("prisma");
    this.registerService("EventService", new EventServices(prisma));
  }

  protected async setupControllers(): Promise<void> {
    const eventService = this.getService<EventServices>("EventService");
    this.registerController("EventController", new EventController(eventService));
  }

  protected async setupRoutes(): Promise<void> {
    const controller = this.getController<EventController>("EventController");

    // Public Routes
    this.router.get(
      "/tenant/:tenantId",
      controller.getTenantEvents.bind(controller),
    );

    this.router.get(
      "/:id",
      controller.getEventById.bind(controller),
    );

    // DJ (Tenant) Routes
    this.router.post(
      "/",
      authenticateUser,
      authorizeRole([UserRole.DJ]),
      validateRequest(createEventSchema),
      controller.createEvent.bind(controller),
    );

    this.router.patch(
      "/:id",
      authenticateUser,
      authorizeRole([UserRole.DJ]),
      validateRequest(updateEventSchema),
      controller.updateEvent.bind(controller),
    );

    this.router.delete(
      "/:id",
      authenticateUser,
      authorizeRole([UserRole.DJ]),
      controller.deleteEvent.bind(controller),
    );
  }
}
