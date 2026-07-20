import { BaseModule } from "@/core/BaseModule";
import { AppLogger } from "@/core/logging/logger";
import { ClientServices } from "./client.service";
import { ClientController } from "./client.controller";
import { authenticateUser, authorizeRole } from "@/middleware/auth";
import { UserRole } from "@/prisma/generated/client";

export class ClientModule extends BaseModule {
  public name: string = "ClientModule";
  public version: string = "1.0.0";
  public basePath: string = "/clients/v1";
  public dependencies?: string[] | undefined;

  private logger = new AppLogger("ClientModule");

  protected async setupUseCases(): Promise<void> {
    const prisma = this.context.getService("prisma");
    this.registerService("ClientService", new ClientServices(prisma));
  }

  protected async setupControllers(): Promise<void> {
    const clientService = this.getService<ClientServices>("ClientService");
    this.registerController("ClientController", new ClientController(clientService));
  }

  protected async setupRoutes(): Promise<void> {
    const controller = this.getController<ClientController>("ClientController");

    this.router.get(
      "/",
      authenticateUser,
      authorizeRole([UserRole.DJ]),
      controller.getMyClients.bind(controller),
    );

    this.router.get(
      "/:id",
      authenticateUser,
      authorizeRole([UserRole.DJ]),
      controller.getClientById.bind(controller),
    );
  }
}
