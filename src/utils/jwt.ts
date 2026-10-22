import jwt, { SignOptions } from "jsonwebtoken";
import { config } from "@/core/config";

const JWT_SECRET = config.security.jwt.secret || "default_secret_key";
const JWT_EXPIRES_IN = config.security.jwt.expiresIn || "7d";

export interface JwtPayload {
  id: string;
  email: string;
  role: string;
}

export interface BookingAccessPayload {
  bookingId: string;
  orderReference: string;
  clientEmail: string;
  role: 'CLIENT';
}

/**
 * Generate a JWT token for a user.
 */
export const generateToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, JWT_SECRET as jwt.Secret, { expiresIn: JWT_EXPIRES_IN as SignOptions["expiresIn"] });
};

/**
 * Verify a JWT token.
 */
export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, JWT_SECRET as jwt.Secret) as JwtPayload;
};

/**
 * Generate a booking portal access token scoped to a specific booking.
 */
export const generateBookingAccessToken = (payload: BookingAccessPayload): string => {
  return jwt.sign(payload, JWT_SECRET as jwt.Secret, { expiresIn: '7d' });
};

/**
 * Verify a booking portal access token.
 */
export const verifyBookingAccessToken = (token: string): BookingAccessPayload => {
  return jwt.verify(token, JWT_SECRET as jwt.Secret) as BookingAccessPayload;
};
