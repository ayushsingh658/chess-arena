import { Router } from 'express';
import * as authService from '../services/authService.js';
import { requireAuth } from '../middleware/auth.js';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
} from '../utils/validators.js';
import { AppError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { Request, Response } from 'express';

// ─────────────────────────────────────────────────────────
// Auth Routes
// ─────────────────────────────────────────────────────────
// POST /auth/register  — Create new account
// POST /auth/login     — Authenticate existing user
// POST /auth/refresh   — Get new access token
// GET  /auth/me        — Get current user profile

export const authRouter = Router();

/**
 * POST /auth/register
 * Creates a new user account with hashed password.
 * Returns user profile + access token.
 */
authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const validated = registerSchema.parse(req.body);

    const result = await authService.register(
      validated.username,
      validated.email,
      validated.password
    );

    // Generate refresh token and set as httpOnly cookie
    const tokens = authService.generateTokenPair(
      result.user.id,
      result.user.username
    );

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/auth/refresh',
    });

    res.status(201).json({
      user: result.user,
      accessToken: tokens.accessToken,
    });
  } catch (error) {
    handleAuthError(res, error);
  }
});

/**
 * POST /auth/guest
 * Creates and logs in an anonymous guest.
 */
authRouter.post('/guest', async (_req: Request, res: Response) => {
  try {
    const result = await authService.loginAsGuest();

    // Generate refresh token and set as httpOnly cookie
    const tokens = authService.generateTokenPair(
      result.user.id,
      result.user.username
    );

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/auth/refresh',
    });

    res.status(201).json({
      user: result.user,
      accessToken: tokens.accessToken,
    });
  } catch (error) {
    handleAuthError(res, error);
  }
});

/**
 * POST /auth/login
 * Authenticates with email + password.
 * Returns user profile + access token.
 */
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const validated = loginSchema.parse(req.body);

    const result = await authService.login(
      validated.email,
      validated.password
    );

    // Generate refresh token and set as httpOnly cookie
    const tokens = authService.generateTokenPair(
      result.user.id,
      result.user.username
    );

    res.cookie('refreshToken', tokens.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/auth/refresh',
    });

    res.status(200).json({
      user: result.user,
      accessToken: tokens.accessToken,
    });
  } catch (error) {
    handleAuthError(res, error);
  }
});

/**
 * POST /auth/refresh
 * Issues a new access token using the refresh token cookie.
 * The refresh token is stored in an httpOnly cookie, not in
 * localStorage — this prevents XSS attacks from stealing it.
 */
authRouter.post('/refresh', async (req: Request, res: Response) => {
  try {
    // Try cookie first, then request body as fallback
    const refreshToken =
      req.cookies?.refreshToken ||
      refreshTokenSchema.parse(req.body).refreshToken;

    const result = await authService.refreshAccessToken(refreshToken);

    res.status(200).json(result);
  } catch (error) {
    handleAuthError(res, error);
  }
});

/**
 * GET /auth/me
 * Returns the authenticated user's profile.
 * Requires a valid access token (via requireAuth middleware).
 */
authRouter.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const profile = await authService.getProfile(req.user!.userId);

    res.status(200).json({ user: profile });
  } catch (error) {
    handleAuthError(res, error);
  }
});

/**
 * POST /auth/logout
 * Clears the refresh token cookie.
 */
authRouter.post('/logout', (_req: Request, res: Response) => {
  res.clearCookie('refreshToken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/auth/refresh',
  });

  res.status(200).json({ message: 'Logged out successfully' });
});

/**
 * Centralized error handler for auth routes.
 * Maps known error types to appropriate HTTP status codes.
 */
function handleAuthError(res: Response, error: unknown): void {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: error.code,
      message: error.message,
    });
    return;
  }

  // Zod validation errors
  if (error && typeof error === 'object' && 'issues' in error) {
    const zodError = error as { issues: Array<{ path: (string | number)[]; message: string }> };
    const fieldErrors = zodError.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));

    res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Validation failed',
      fields: fieldErrors,
    });
    return;
  }

  logger.error('Auth', 'Unexpected error', error);
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  });
}
