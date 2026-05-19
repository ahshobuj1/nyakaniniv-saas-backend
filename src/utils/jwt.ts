import jwt, { SignOptions } from "jsonwebtoken";
import { config } from "@/core/config";

const JWT_SECRET = config.security.jwt.secret || "default_secret_key";
const JWT_EXPIRES_IN = config.security.jwt.expiresIn || "7d";

export interface JwtPayload {
  id: string;
  email: string;
  role: string;
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
