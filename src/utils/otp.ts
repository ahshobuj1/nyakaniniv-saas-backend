import crypto from "crypto";

/**
 * Generates a random 6-digit OTP.
 */
export const generateOtp = (): string => {
  // Generate a random number between 100000 and 999999
  const otp = crypto.randomInt(100000, 1000000);
  return otp.toString();
};
