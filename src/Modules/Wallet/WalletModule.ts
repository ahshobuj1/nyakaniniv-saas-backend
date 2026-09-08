import { BaseModule } from "@/core/BaseModule";
import { AppLogger } from "@/core/logging/logger";
import { WalletService } from "./wallet.service";
import { WalletController } from "./wallet.controller";
import { authenticateUser } from "@/middleware/auth";

export class WalletModule extends BaseModule {
  public name: string = "WalletModule";
  public version: string = "1.0.0";
  public basePath: string = "/wallet/v1/";
  public dependencies?: string[] | undefined;

  private logger = new AppLogger("WalletModule");

  protected async setupUseCases(): Promise<void> {
    const prisma = this.context.getService("prisma");
    this.registerService("WalletService", new WalletService(prisma));
  }

  protected async setupControllers(): Promise<void> {
    const service = this.getService<WalletService>("WalletService");
    this.registerController("WalletController", new WalletController(service));
  }

  protected async setupRoutes(): Promise<void> {
    const controller = this.getController<WalletController>("WalletController");

    this.router.get(
      "/me",
      authenticateUser,
      controller.getWallet.bind(controller)
    );

    this.router.post(
      "/withdraw",
      authenticateUser,
      controller.withdraw.bind(controller)
    );

    this.router.get(
      "/breakdown",
      controller.previewBreakdown.bind(controller)
    );
  }
}
