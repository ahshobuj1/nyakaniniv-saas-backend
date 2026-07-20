// src/Modules/Auth/AuthDTO.ts
import { z } from "zod";

export const createUserSchema = {
  body: z.object({
    email: z.string().email("Invalid email address"),
    firstName: z.string().min(2, "First name is too short"),
    lastName: z.string().min(2, "Last name is too short"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    role: z.enum(["SUPER_ADMIN", "DJ"]).optional().default("DJ"),
  }),
};

export const verifyOtpSchema = {
  body: z.object({
    email: z.string().email("Invalid email address"),
    otp: z.string().length(6, "OTP must be exactly 6 digits"),
  }),
};

export const resendOtpSchema = {
  body: z.object({
    email: z.string().email("Invalid email address"),
  }),
};

export const loginSchema = {
  body: z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
  }),
};

export const forgotPasswordSchema = {
  body: z.object({
    email: z.string().email("Invalid email address"),
  }),
};

export const resetPasswordSchema = {
  body: z.object({
    email: z.string().email("Invalid email address"),
    otp: z.string().length(6, "OTP must be exactly 6 digits"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
  }),
};

export const changePasswordSchema = {
  body: z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
  }),
};

export type CreateUserDTO = z.infer<typeof createUserSchema.body>;
export type VerifyOtpDTO = z.infer<typeof verifyOtpSchema.body>;
export type LoginDTO = z.infer<typeof loginSchema.body>;
export type ForgotPasswordDTO = z.infer<typeof forgotPasswordSchema.body>;
export type ResetPasswordDTO = z.infer<typeof resetPasswordSchema.body>;
export type ChangePasswordDTO = z.infer<typeof changePasswordSchema.body>;
