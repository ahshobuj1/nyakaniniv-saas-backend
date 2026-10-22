import {Request, Response, NextFunction} from 'express';
import {AuthenticationError, AuthorizationError} from '@/core/errors/AppError';
import {
  verifyToken,
  verifyBookingAccessToken,
  JwtPayload,
  BookingAccessPayload,
} from '@/utils/jwt';
import {AppLogger} from '@/core/logging/logger';

const logger = new AppLogger('AuthMiddleware');

// Extend Express Request interface to include the user payload and booking access payload
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
      bookingAccess?: BookingAccessPayload;
    }
  }
}

/**
 * Middleware to authenticate requests via JWT.
 */
export const authenticateUser = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn(
        'Authentication failed: Missing or invalid Authorization header',
      );
      throw new AuthenticationError(
        'Authentication token is missing or invalid',
      );
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      logger.warn('Authentication failed: Token is missing');
      throw new AuthenticationError('Authentication token is missing');
    }

    // Verify token
    const decoded = verifyToken(token);

    // Attach user payload to request
    req.user = decoded;

    next();
  } catch (error) {
    logger.error('Authentication error', {error});
    next(new AuthenticationError('Invalid or expired authentication token'));
  }
};

/**
 * Middleware to authorize specific roles.
 * Must be used after authenticateUser.
 */
export const authorizeRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AuthenticationError('User is not authenticated'));
    }

    if (!roles.includes(req.user.role)) {
      logger.warn(
        `Authorization failed: User role ${req.user.role} is not in allowed roles ${roles.join(', ')}`,
      );
      return next(
        new AuthorizationError(
          'You do not have permission to perform this action',
        ),
      );
    }

    next();
  };
};

/**
 * Optional authentication middleware.
 * If a valid token is present, attaches user to req.user.
 * If not present or invalid, continues without setting req.user.
 */
export const optionalAuth = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token) {
        try {
          const decoded = verifyToken(token);
          req.user = decoded;
        } catch {
          // May be a booking access token
          try {
            const bookingDecoded = verifyBookingAccessToken(token);
            req.bookingAccess = bookingDecoded;
          } catch {
            // Neither
          }
        }
      }
    }
  } catch {
    // Token invalid or expired — ignore, proceed as unauthenticated
  }
  next();
};

/**
 * Middleware to authenticate access to a booking.
 * Accepts either:
 * 1. Logged-in DJ / Admin user token via standard Bearer token.
 * 2. Verified client booking token via Bearer token or x-booking-access-token header.
 * Enforces cross-booking protection (client token cannot access other bookings).
 */
export const authenticateBookingAccess = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const requestedBookingId = String(req.params.id || '');

    // 1. Check for custom header or standard Authorization header
    const bookingHeader = req.headers['x-booking-access-token'] as string;
    const authHeader = req.headers.authorization;
    let token = bookingHeader;

    if (!token && authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      return next(
        new AuthenticationError(
          'Booking access authentication required. Please verify with your email OTP.',
        ),
      );
    }

    // Try verifying as a regular user first
    try {
      const userPayload = verifyToken(token);
      if (userPayload && userPayload.id) {
        req.user = userPayload;
        return next();
      }
    } catch {
      // Not a user token, attempt booking access token next
    }

    // Try verifying as booking access token
    try {
      const accessPayload = verifyBookingAccessToken(token);
      if (accessPayload && accessPayload.bookingId) {
        // Enforce cross-booking access prevention
        if (
          requestedBookingId &&
          accessPayload.bookingId !== requestedBookingId &&
          accessPayload.orderReference !== requestedBookingId.toUpperCase()
        ) {
          logger.warn(
            `Cross-booking access attempt denied: token bookingId ${accessPayload.bookingId} != requested ${requestedBookingId}`,
          );
          return next(
            new AuthorizationError('Cross-booking access is denied.'),
          );
        }

        req.bookingAccess = accessPayload;
        return next();
      }
    } catch {
      // Invalid booking access token
    }

    return next(
      new AuthenticationError(
        'Invalid or expired booking access session. Please re-authenticate with your booking code and OTP.',
      ),
    );
  } catch (error) {
    logger.error('authenticateBookingAccess error', {error});
    return next(
      new AuthenticationError('Authentication failed for booking access.'),
    );
  }
};
