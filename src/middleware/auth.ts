import {Request, Response, NextFunction} from 'express';
import {AuthenticationError} from '@/core/errors/AppError';
import {verifyToken, JwtPayload} from '@/utils/jwt';
import {AppLogger} from '@/core/logging/logger';

const logger = new AppLogger('AuthMiddleware');

// Extend Express Request interface to include the user payload
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
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
        new AuthenticationError(
          'You do not have permission to perform this action',
        ),
      );
    }

    next();
  };
};
