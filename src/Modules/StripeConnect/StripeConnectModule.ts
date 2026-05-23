import { BaseModule } from "@/core/BaseModule";
import { AppLogger } from "@/core/logging/logger";
import { StripeConnectService } from "./stripe-connect.service";
import { StripeConnectController } from "./stripe-connect.controller";
import { authenticateUser } from "@/middleware/auth";

export class StripeConnectModule extends BaseModule {
  public name: string = "StripeConnectModule";
  public version: string = "1.0.0";
  public basePath: string = "/stripe-connect/v1/";
  public dependencies?: string[] | undefined;

  private logger = new AppLogger("StripeConnectModule");

  protected async setupUseCases(): Promise<void> {
    const prisma = this.context.getService("prisma");
    this.registerService("StripeConnectService", new StripeConnectService(prisma));
  }

  protected async setupControllers(): Promise<void> {
    const service = this.getService<StripeConnectService>("StripeConnectService");
    this.registerController("StripeConnectController", new StripeConnectController(service));
  }

  protected async setupRoutes(): Promise<void> {
    const controller = this.getController<StripeConnectController>("StripeConnectController");

    this.router.post(
      "/onboard",
      authenticateUser,
      controller.getOnboardingLink.bind(controller)
    );

    this.router.get(
      "/status",
      authenticateUser,
      controller.checkStatus.bind(controller)
    );
  }
}
