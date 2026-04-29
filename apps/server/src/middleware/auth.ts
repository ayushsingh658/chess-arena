import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/authService.js';
import { AuthError } from '../utils/errors.js';

// ─────────────────────────────────────────────────────────
// HTTP Auth Middleware
// ─────────────────────────────────────────────────────────
// Extracts and verifies the JWT from the Authorization header.
// Attaches decoded user data to `req.user` for downstream handlers.

/** Extend Express Request to include authenticated user data */
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        username: string;
      };
    }
  }
}

/**
 * Middleware that requires a valid JWT Bearer token.
 * Use on any route that needs authentication.
 *
 * @example
 * router.get('/profile', requireAuth, profileHandler);
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new AuthError('Missing or malformed Authorization header');
    }

    const token = authHeader.slice(7); // Remove 'Bearer '
    const payload = verifyToken(token);

    req.user = {
      userId: payload.userId,
      username: payload.username,
    };

    next();
  } catch (error) {
    if (error instanceof AuthError) {
      res.status(401).json({
        error: error.code,
        message: error.message,
      });
      return;
    }
    res.status(500).json({
      error: 'INTERNAL_ERROR',
      message: 'Authentication failed',
    });
  }
}
