import { BaseModule } from "@/core/BaseModule";
import { AppLogger } from "@/core/logging/logger";
import { SubscriptionServices } from "./subscription.service";
import { SubscriptionController } from "./subscription.controller";
import { validateRequest } from "@/middleware/validation";
import { authenticateUser, authorizeRole } from "@/middleware/auth";
import { UserRole } from "@/prisma/generated/client";
import { createSubscriptionPlanSchema, updateSubscriptionPlanSchema, subscribeSchema } from "./SubscriptionDTO";
import express from 'express';

export class SubscriptionModule extends BaseModule {
  public name: string = "SubscriptionModule";
  public version: string = "1.0.0";
  public basePath: string = "/subscriptions/v1/";
  public dependencies?: string[] | undefined;

  private logger = new AppLogger("SubscriptionModule");

  protected async setupUseCases(): Promise<void> {
    const prisma = this.context.getService("prisma");
    this.registerService("SubscriptionService", new SubscriptionServices(prisma));
  }

  protected async setupControllers(): Promise<void> {
    const subscriptionService = this.getService<SubscriptionServices>("SubscriptionService");
    this.registerController("SubscriptionController", new SubscriptionController(subscriptionService));
  }

  protected async setupRoutes(): Promise<void> {
    const controller = this.getController<SubscriptionController>("SubscriptionController");

    // Admin Routes for Plans
    this.router.post(
      "/plans",
      authenticateUser,
      authorizeRole([UserRole.SUPER_ADMIN]),
      validateRequest(createSubscriptionPlanSchema),
      controller.createPlan.bind(controller),
    );

    this.router.patch(
      "/plans/:id",
      authenticateUser,
      authorizeRole([UserRole.SUPER_ADMIN]),
      validateRequest(updateSubscriptionPlanSchema),
      controller.updatePlan.bind(controller),
    );

    this.router.delete(
      "/plans/:id",
      authenticateUser,
      authorizeRole([UserRole.SUPER_ADMIN]),
      controller.deletePlan.bind(controller),
    );

    // Public / Shared Routes
    this.router.get(
      "/plans",
      controller.getAllPlans.bind(controller),
    );

    // DJ Routes for Subscription
    this.router.post(
      "/subscribe",
      authenticateUser,
      authorizeRole([UserRole.DJ]),
      validateRequest(subscribeSchema),
      controller.subscribe.bind(controller),
    );

    this.router.post(
      "/cancel",
      authenticateUser,
      authorizeRole([UserRole.DJ]),
      controller.cancelSubscription.bind(controller),
    );

    // Stripe Webhook Route (Needs raw body)
    this.router.post(
      "/webhook",
      express.raw({ type: 'application/json' }),
      controller.handleWebhook.bind(controller),
    );
  }
}
