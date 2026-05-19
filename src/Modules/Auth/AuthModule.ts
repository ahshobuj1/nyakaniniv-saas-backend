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

    /**
     * @swagger
     * /auth/v1/register:
     *   post:
     *     summary: Register a new user
     *     tags: [Auth]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - email
     *               - password
     *               - firstName
     *               - lastName
     *             properties:
     *               email:
     *                 type: string
     *                 format: email
     *                 example: user@example.com
     *               password:
     *                 type: string
     *                 example: strongPassword123
     *               firstName:
     *                 type: string
     *                 example: John
     *               lastName:
     *                 type: string
     *                 example: Doe
     *     responses:
     *       201:
     *         description: User registered successfully
     *       400:
     *         description: Bad request (validation error)
     *       409:
     *         description: User already exists
     */
    this.router.post(
      "/register",
      validateRequest(createUserSchema),
      controller.register.bind(controller),
    );

    /**
     * @swagger
     * /auth/v1/verify:
     *   post:
     *     summary: Verify OTP
     *     tags: [Auth]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - email
     *               - otp
     *             properties:
     *               email:
     *                 type: string
     *                 format: email
     *               otp:
     *                 type: string
     *                 example: "123456"
     *     responses:
     *       200:
     *         description: Email verified successfully
     *       401:
     *         description: Invalid or expired OTP
     */
    this.router.post(
      "/verify",
      validateRequest(verifyOtpSchema),
      controller.verifyOtp.bind(controller),
    );

    /**
     * @swagger
     * /auth/v1/login:
     *   post:
     *     summary: User Login
     *     tags: [Auth]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - email
     *               - password
     *             properties:
     *               email:
     *                 type: string
     *                 format: email
     *               password:
     *                 type: string
     *     responses:
     *       200:
     *         description: Login successful
     *       401:
     *         description: Invalid credentials or unverified email
     */
    this.router.post(
      "/login",
      validateRequest(loginSchema),
      controller.login.bind(controller),
    );

    /**
     * @swagger
     * /auth/v1/logout:
     *   post:
     *     summary: User Logout
     *     tags: [Auth]
     *     security:
     *       - bearerAuth: []
     *     responses:
     *       200:
     *         description: Logout successful
     */
    this.router.post(
      "/logout",
      authenticateUser,
      controller.logout.bind(controller),
    );

    /**
     * @swagger
     * /auth/v1/forgot-password:
     *   post:
     *     summary: Request password reset OTP
     *     tags: [Auth]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - email
     *             properties:
     *               email:
     *                 type: string
     *                 format: email
     *     responses:
     *       200:
     *         description: OTP sent to email
     */
    this.router.post(
      "/forgot-password",
      validateRequest(forgotPasswordSchema),
      controller.forgotPassword.bind(controller),
    );

    /**
     * @swagger
     * /auth/v1/reset-password:
     *   post:
     *     summary: Reset password with OTP
     *     tags: [Auth]
     *     requestBody:
     *       required: true
     *       content:
     *         application/json:
     *           schema:
     *             type: object
     *             required:
     *               - email
     *               - otp
     *               - newPassword
     *             properties:
     *               email:
     *                 type: string
     *                 format: email
     *               otp:
     *                 type: string
     *                 example: "123456"
     *               newPassword:
     *                 type: string
     *     responses:
     *       200:
     *         description: Password reset successfully
     *       401:
     *         description: Invalid or expired OTP
     */
    this.router.post(
      "/reset-password",
      validateRequest(resetPasswordSchema),
      controller.resetPassword.bind(controller),
    );
  }
}
