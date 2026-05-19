// src/Modules/Auth/AuthModule.ts
import { BaseModule } from "@/core/BaseModule";
import { AppLogger } from "@/core/logging/logger";
import { AuthServices } from "./auth.service";
import { AuthController } from "./auth.controller";
import { validateRequest } from "@/middleware/validation";
import { authenticateUser } from "@/middleware/auth";
import {
  createUserSchema,
  verifyOtpSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./AuthDTO";

export class AuthModule extends BaseModule {
  public name: string = "AuthModule";
  public version: string = "1.0.0";
  public basePath: string = "/auth/v1/";
  public dependencies?: string[] | undefined;

  private logger = new AppLogger("AuthModule");

  protected async setupUseCases(): Promise<void> {
    const prisma = this.context.getService("prisma");
    this.registerService("AuthService", new AuthServices(prisma));
  }
  protected async setupControllers(): Promise<void> {
    const authService = this.getService<AuthServices>("AuthService");
    this.registerController("AuthController", new AuthController(authService));
  }

  protected async setupRoutes(): Promise<void> {
    const controller = this.getController<AuthController>("AuthController");

    // Registration
    this.router.post(
      "/register",
      validateRequest(createUserSchema),
      controller.register.bind(controller),
    );

    // Verify OTP
    this.router.post(
      "/verify",
      validateRequest(verifyOtpSchema),
      controller.verifyOtp.bind(controller),
    );

    // Login
    this.router.post(
      "/login",
      validateRequest(loginSchema),
      controller.login.bind(controller),
    );

    // Logout
    this.router.post(
      "/logout",
      authenticateUser,
      controller.logout.bind(controller),
    );

    // Forgot Password
    this.router.post(
      "/forgot-password",
      validateRequest(forgotPasswordSchema),
      controller.forgotPassword.bind(controller),
    );

    // Reset Password
    this.router.post(
      "/reset-password",
      validateRequest(resetPasswordSchema),
      controller.resetPassword.bind(controller),
    );
  }
}
