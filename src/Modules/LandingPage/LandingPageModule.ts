import { BaseModule } from "@/core/BaseModule";
import { AppLogger } from "@/core/logging/logger";
import { LandingPageServices } from "./landingPage.service";
import { LandingPageController } from "./landingPage.controller";
import { authenticateUser, authorizeRole } from "@/middleware/auth";
import { UserRole } from "@/prisma/generated/client";
import { IFileUploader } from "@/utils/IFileUploader";
import multer from "multer";

export class LandingPageModule extends BaseModule {
  public name: string = "LandingPageModule";
  public version: string = "1.0.0";
  public basePath: string = "/landing-page/v1/";
  public dependencies?: string[] | undefined;

  private logger = new AppLogger("LandingPageModule");

  protected async setupUseCases(): Promise<void> {
    const prisma = this.context.getService("prisma");
    const fileUploader = this.context.getService("fileUploader") as IFileUploader;
    this.registerService("LandingPageService", new LandingPageServices(prisma, fileUploader));
  }

  protected async setupControllers(): Promise<void> {
    const landingPageService = this.getService<LandingPageServices>("LandingPageService");
    this.registerController("LandingPageController", new LandingPageController(landingPageService));
  }

  protected async setupRoutes(): Promise<void> {
    const controller = this.getController<LandingPageController>("LandingPageController");
    const upload = multer({ dest: 'tmp/' });

    // Public Route
    this.router.get(
      "/content",
      controller.getLandingPageContent.bind(controller),
    );

    // Common Admin Middleware
    const adminMiddleware = [
      authenticateUser,
      authorizeRole([UserRole.SUPER_ADMIN]),
    ];

    // --- Hero ---
    this.router.post("/hero", ...adminMiddleware, upload.single('image'), controller.createHero.bind(controller));
    this.router.patch("/hero/:id", ...adminMiddleware, upload.single('image'), controller.updateHero.bind(controller));
    this.router.delete("/hero/:id", ...adminMiddleware, controller.deleteHero.bind(controller));

    // --- Step ---
    this.router.post("/step", ...adminMiddleware, upload.single('image'), controller.createStep.bind(controller));
    this.router.patch("/step/:id", ...adminMiddleware, upload.single('image'), controller.updateStep.bind(controller));
    this.router.delete("/step/:id", ...adminMiddleware, controller.deleteStep.bind(controller));

    // --- Service ---
    this.router.post("/service", ...adminMiddleware, upload.single('image'), controller.createService.bind(controller));
    this.router.patch("/service/:id", ...adminMiddleware, upload.single('image'), controller.updateService.bind(controller));
    this.router.delete("/service/:id", ...adminMiddleware, controller.deleteService.bind(controller));

    // --- FAQ ---
    this.router.post("/faq", ...adminMiddleware, controller.createFaq.bind(controller));
    this.router.patch("/faq/:id", ...adminMiddleware, controller.updateFaq.bind(controller));
    this.router.delete("/faq/:id", ...adminMiddleware, controller.deleteFaq.bind(controller));

    // --- Marquee ---
    this.router.post("/marquee", ...adminMiddleware, upload.single('image'), controller.createMarquee.bind(controller));
    this.router.patch("/marquee/:id", ...adminMiddleware, upload.single('image'), controller.updateMarquee.bind(controller));
    this.router.delete("/marquee/:id", ...adminMiddleware, controller.deleteMarquee.bind(controller));
  }
}
