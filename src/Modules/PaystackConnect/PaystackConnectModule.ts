import { BaseModule } from "@/core/BaseModule";
import { AppLogger } from "@/core/logging/logger";
import { PaystackConnectService } from "./paystack-connect.service";
import { PaystackConnectController } from "./paystack-connect.controller";
import { authenticateUser } from "@/middleware/auth";

export class PaystackConnectModule extends BaseModule {
  public name: string = "PaystackConnectModule";
  public version: string = "1.0.0";
  public basePath: string = "/paystack-connect/v1/";
  public dependencies?: string[] | undefined;

  private logger = new AppLogger("PaystackConnectModule");

  protected async setupUseCases(): Promise<void> {
    const prisma = this.context.getService("prisma");
    this.registerService("PaystackConnectService", new PaystackConnectService(prisma));
  }

  protected async setupControllers(): Promise<void> {
    const service = this.getService<PaystackConnectService>("PaystackConnectService");
    this.registerController("PaystackConnectController", new PaystackConnectController(service));
  }

  protected async setupRoutes(): Promise<void> {
    const controller = this.getController<PaystackConnectController>("PaystackConnectController");

    this.router.post(
      "/onboard",
      authenticateUser,
      controller.onboard.bind(controller)
    );

    this.router.get(
      "/status",
      authenticateUser,
      controller.getStatus.bind(controller)
    );

    this.router.get(
      "/banks",
      authenticateUser,
      controller.getBanks.bind(controller)
    );

    this.router.delete(
      "/disconnect",
      authenticateUser,
      controller.disconnect.bind(controller)
    );
  }
}
