import { BaseModule } from "@/core/BaseModule";
import { AppLogger } from "@/core/logging/logger";
import { SupportTicketServices } from "./supportTicket.service";
import { SupportTicketController } from "./supportTicket.controller";
import { validateRequest } from "@/middleware/validation";
import { authenticateUser, authorizeRole } from "@/middleware/auth";
import { UserRole } from "@/prisma/generated/client";
import {
  createSupportTicketSchema,
  updateTicketStatusSchema,
} from "./SupportTicketDTO";

// If optionalAuth doesn't exist, we will just not enforce it on create, but we can read the token if provided.

export class SupportTicketModule extends BaseModule {
  public name: string = "SupportTicketModule";
  public version: string = "1.0.0";
  public basePath: string = "/tickets/v1/";
  public dependencies?: string[] | undefined;

  private logger = new AppLogger("SupportTicketModule");

  protected async setupUseCases(): Promise<void> {
    const prisma = this.context.getService("prisma");
    const emailProvider = this.context.getService("email");
    this.registerService("SupportTicketService", new SupportTicketServices(prisma, emailProvider));
  }

  protected async setupControllers(): Promise<void> {
    const ticketService = this.getService<SupportTicketServices>("SupportTicketService");
    this.registerController("SupportTicketController", new SupportTicketController(ticketService));
  }

  protected async setupRoutes(): Promise<void> {
    const controller = this.getController<SupportTicketController>("SupportTicketController");

    // We can use a try-catch approach for optional auth, or just a custom middleware
    // For now, let's keep it entirely public to submit tickets
    this.router.post(
      "/",
      validateRequest(createSupportTicketSchema),
      controller.createTicket.bind(controller),
    );

    // Admin Routes
    this.router.get(
      "/all",
      authenticateUser,
      authorizeRole([UserRole.SUPER_ADMIN]),
      controller.getAllTickets.bind(controller),
    );

    this.router.patch(
      "/:id/status",
      authenticateUser,
      authorizeRole([UserRole.SUPER_ADMIN]),
      validateRequest(updateTicketStatusSchema),
      controller.updateTicketStatus.bind(controller),
    );

    // DJ / Authenticated User Routes
    this.router.get(
      "/my-tickets",
      authenticateUser,
      controller.getMyTickets.bind(controller),
    );
  }
}
