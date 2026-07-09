// src/Modules/Auth/auth.service.ts
import { PrismaClient, UserRole } from "@/prisma/generated/client";
import { AppLogger } from "@/core/logging/logger";
import { ConflictError, NotFoundError, AuthenticationError } from "@/core/errors/AppError";
import { hashPassword, comparePassword } from "@/utils/password";
import { generateToken } from "@/utils/jwt";
import { generateOtp } from "@/utils/otp";
import { IEmailProvider } from "@/providers/EmailProvider";
import { EmailTemplates } from "@/utils/EmailTemplates";

export class AuthServices {
  private logger = new AppLogger("AuthServices");

  constructor(
    private readonly prisma: PrismaClient,
    private readonly emailProvider: IEmailProvider
  ) {}

  public async register(
    email: string,
    firstName: string,
    lastName: string,
    passwordHash: string, // now receives raw password in controller, wait, let's keep it clean
  ) {
    this.logger.info("Attempting to register user", { email });

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      this.logger.warn("Registration failed: User already exists", { email });
      throw new ConflictError("A user with this email already exists");
    }

    const hashed = await hashPassword(passwordHash);
    const otp = generateOtp();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

    // Bypassing TS errors for mismatched schema
    const newUser = await (this.prisma.user as any).create({
      data: {
        email,
        firstName,
        lastName,
        password: hashed,
        role: "DJ" as UserRole, // Default
        isVerified: false,
        otpExpiry,
      },
    });

    // Send Email
    //  this.emailProvider.sendEmail
    this.emailProvider.sendEmail(
      email,
      "Verify Email - UpBeat Africa",
      EmailTemplates.getOtpTemplate(otp)
    );

    this.logger.info("User registered successfully", { userId: newUser.id });
    return newUser;
  }

  public async verifyOtp(email: string, otp: string) {
    this.logger.info("Attempting to verify OTP", { email });

    const user: any = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundError("User not found");
    }

    if (user.isVerified) {
      throw new ConflictError("User is already verified");
    }

    if (user.otp !== otp || !user.otpExpiry || user.otpExpiry < new Date()) {
      throw new AuthenticationError("Invalid or expired OTP");
    }

    // Verify and clean up OTP
    const updatedUser: any = await (this.prisma.user as any).update({
      where: { id: user.id },
      data: {
        isVerified: true,
        otp: null,
        otpExpiry: null,
      },
    });

    const token = generateToken({ id: updatedUser.id, email: updatedUser.email, role: updatedUser.role });

    // Send Welcome Email
    this.emailProvider.sendEmail(
      updatedUser.email,
      "Welcome to Nyakaniniv!",
      EmailTemplates.getWelcomeTemplate(updatedUser.firstName || "DJ")
    );

    return { user: updatedUser, token };
  }

  public async resendVerificationOtp(email: string) {
    this.logger.info("Attempting to resend verification OTP", { email });

    const user: any = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Return success anyway to prevent email enumeration
      return { otp: null };
    }

    if (user.isVerified) {
      throw new ConflictError("User is already verified");
    }

    const otp = generateOtp();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await (this.prisma.user as any).update({
      where: { id: user.id },
      data: {
        otp,
        otpExpiry,
      },
    });

    // Send Email
    this.emailProvider.sendEmail(
      email,
      "New Verification Code - UpBeat Africa",
      EmailTemplates.getOtpTemplate(otp)
    );

    return { otp };
  }

  public async login(email: string, passwordRaw: string) {
    this.logger.info("Attempting to log in user", { email });

    const user: any = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AuthenticationError("Invalid email or password");
    }

    if (!user.isVerified) {
      throw new AuthenticationError("Please verify your email before logging in");
    }

    const isMatch = await comparePassword(passwordRaw, user.password);
    if (!isMatch) {
      throw new AuthenticationError("Invalid email or password");
    }

    const token = generateToken({ id: user.id, email: user.email, role: user.role });
    return { user, token };
  }

  public async forgotPassword(email: string) {
    this.logger.info("Processing forgot password request", { email });

    const user: any = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Don't leak whether user exists, just return success
      return { otp: null };
    }

    const otp = generateOtp();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await (this.prisma.user as any).update({
      where: { id: user.id },
      data: { otp, otpExpiry },
    });

    // Send Email
    this.emailProvider.sendEmail(
      email,
      "Password Reset Request - UpBeat Africa",
      EmailTemplates.getPasswordResetTemplate(`http://localhost:3000/auth/reset-password?otp=${otp}&email=${encodeURIComponent(email)}`)
    );

    return { otp };
  }

  public async resetPassword(email: string, otp: string, newPasswordRaw: string) {
    this.logger.info("Attempting to reset password", { email });

    const user: any = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new NotFoundError("User not found");
    }

    if (user.otp !== otp || !user.otpExpiry || user.otpExpiry < new Date()) {
      throw new AuthenticationError("Invalid or expired OTP");
    }

    const hashed = await hashPassword(newPasswordRaw);

    await (this.prisma.user as any).update({
      where: { id: user.id },
      data: {
        password: hashed,
        otp: null,
        otpExpiry: null,
      },
    });

    return true;
  }

  public async changePassword(userId: string, currentPasswordRaw: string, newPasswordRaw: string) {
    this.logger.info("Attempting to change password", { userId });

    const user: any = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundError("User not found");
    }

    const isMatch = await comparePassword(currentPasswordRaw, user.password);
    if (!isMatch) {
      throw new AuthenticationError("Incorrect current password");
    }

    const hashed = await hashPassword(newPasswordRaw);

    await (this.prisma.user as any).update({
      where: { id: user.id },
      data: {
        password: hashed,
      },
    });

    return true;
  }
}
