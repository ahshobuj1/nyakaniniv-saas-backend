// src/Modules/Auth/auth.controller.ts
import { Request, Response } from "express";
import { BaseController } from "@/core/BaseController";
import { AppLogger } from "@/core/logging/logger";
import { CreateUserDTO, VerifyOtpDTO, LoginDTO, ForgotPasswordDTO, ResetPasswordDTO, ChangePasswordDTO } from "./AuthDTO";
import { AuthServices } from "./auth.service";

export class AuthController extends BaseController {
  private logger = new AppLogger("AuthController");

  constructor(private readonly authService: AuthServices) {
    super();
  }

  public async register(req: Request, res: Response) {
    const { email, firstName, lastName, password } = req.validatedBody as CreateUserDTO;
    
    const newUser = await this.authService.register(email, firstName, lastName, password);
    // const { password: _, otp, otpExpiry, ...userWithoutSensitiveInfo } = newUser as any;

    return this.sendCreatedResponse(req, res, newUser, "User registered successfully. Please verify your email.");
  }

  public async resendVerificationOtp(req: Request, res: Response) {
    const { email } = req.validatedBody as { email: string };
    const { otp } = await this.authService.resendVerificationOtp(email);

    return this.sendResponse(
      req,
      res,
      `OTP resend successfully, a new OTP has been sent to your email.`,
      200,
      { otp }
    );
  }

  public async verifyOtp(req: Request, res: Response) {
    const { email, otp } = req.validatedBody as VerifyOtpDTO;
    
    const { user, token } = await this.authService.verifyOtp(email, otp);
    const { password: _, ...safeUser } = user;

    return this.sendResponse(req, res, "Email verified successfully", 200, { user: safeUser, token });
  }

  public async login(req: Request, res: Response) {
    const { email, password } = req.validatedBody as LoginDTO;

    const { user, token } = await this.authService.login(email, password);
    const { password: _, otp, otpExpiry, ...safeUser } = user as any;

    return this.sendResponse(req, res, "Login successful", 200, { user: safeUser, token });
  }

  public async logout(req: Request, res: Response) {
    // With stateless JWT, logout is primarily a client-side action.
    return this.sendResponse(req, res, "Logout successful", 200, null);
  }

  public async forgotPassword(req: Request, res: Response) {
    const { email } = req.validatedBody as ForgotPasswordDTO;
    
  const {otp} =  await this.authService.forgotPassword(email);
    
    // Always return success to prevent email enumeration
    return this.sendResponse(req, res, "If an account exists with that email, a password reset OTP has been sent.", 200, {otp});
  }

  public async resetPassword(req: Request, res: Response) {
    const { email, otp, newPassword } = req.validatedBody as ResetPasswordDTO;
    
    await this.authService.resetPassword(email, otp, newPassword);
    
    return this.sendResponse(req, res, "Password has been reset successfully", 200, null);
  }

  public async changePassword(req: Request, res: Response) {
    const { currentPassword, newPassword } = req.validatedBody as ChangePasswordDTO;
    const userId = req.user?.id; // Assuming authenticateUser middleware sets req.user

    if (!userId) {
      return this.sendResponse(req, res, "Unauthorized", 401, null);
    }

    await this.authService.changePassword(userId, currentPassword, newPassword);

    return this.sendResponse(req, res, "Password has been changed successfully", 200, null);
  }
}
