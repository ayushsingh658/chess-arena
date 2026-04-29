import bcrypt from 'bcrypt';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { prisma } from '../config/database.js';
import { env } from '../config/env.js';
import { AuthError, ValidationError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { PublicProfile, AuthResponse } from '@chess-arena/shared';

// ─────────────────────────────────────────────────────────
// Auth Service
// ─────────────────────────────────────────────────────────
// Handles user registration, login, and JWT token management.
// Passwords are hashed with bcrypt (12 salt rounds — balances
// security vs. performance; each hash takes ~250ms).

const SALT_ROUNDS = 12;

/** JWT payload shape */
interface JwtPayload {
  userId: string;
  username: string;
}

/**
 * Strips sensitive fields from a user record.
 * Never expose email, passwordHash, or volatility to clients.
 */
function toPublicProfile(user: {
  id: string;
  username: string;
  eloRating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
}): PublicProfile {
  return {
    id: user.id,
    username: user.username,
    eloRating: user.eloRating,
    gamesPlayed: user.gamesPlayed,
    wins: user.wins,
    losses: user.losses,
    draws: user.draws,
  };
}

/**
 * Sign a JWT access token.
 */
function signAccessToken(payload: JwtPayload): string {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as unknown as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

/**
 * Sign a longer-lived refresh token.
 */
function signRefreshToken(payload: JwtPayload): string {
  const options: SignOptions = {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as unknown as SignOptions['expiresIn'],
  };
  return jwt.sign(payload, env.JWT_SECRET, options);
}

/**
 * Verify and decode a JWT token.
 * Throws AuthError if the token is invalid or expired.
 */
export function verifyToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
    return { userId: decoded.userId, username: decoded.username };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AuthError('Token has expired');
    }
    if (err instanceof jwt.JsonWebTokenError) {
      throw new AuthError('Invalid token');
    }
    throw new AuthError('Token verification failed');
  }
}

/**
 * Register a new user account.
 *
 * Validates uniqueness of username and email,
 * hashes the password, and returns JWT tokens.
 */
export async function register(
  username: string,
  email: string,
  password: string
): Promise<AuthResponse> {
  // Check for existing user
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { username: username.toLowerCase() },
        { email: email.toLowerCase() },
      ],
    },
  });

  if (existingUser) {
    if (existingUser.email === email.toLowerCase()) {
      throw new ValidationError('An account with this email already exists');
    }
    throw new ValidationError('This username is already taken');
  }

  // Hash password (bcrypt auto-generates a unique salt per hash)
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      passwordHash,
    },
  });

  const tokenPayload: JwtPayload = {
    userId: user.id,
    username: user.username,
  };

  logger.info('Auth', `User registered: ${user.username} (${user.id})`);

  return {
    user: toPublicProfile(user),
    accessToken: signAccessToken(tokenPayload),
  };
}

/**
 * Register and login instantly as an anonymous guest.
 */
export async function loginAsGuest(): Promise<AuthResponse> {
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  const username = `Guest_${randomSuffix}`;
  const email = `guest_${randomSuffix}_${Date.now()}@anon.local`;
  const password = `guest_${Math.random().toString(36).slice(2)}`;

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      passwordHash,
    },
  });

  const tokenPayload: JwtPayload = {
    userId: user.id,
    username: user.username,
  };

  logger.info('Auth', `Guest logged in: ${user.username} (${user.id})`);

  return {
    user: toPublicProfile(user),
    accessToken: signAccessToken(tokenPayload),
  };
}


/**
 * Authenticate an existing user with email + password.
 *
 * Uses constant-time comparison via bcrypt.compare()
 * to prevent timing attacks.
 */
export async function login(
  email: string,
  password: string
): Promise<AuthResponse> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    // Generic message to prevent user enumeration
    throw new AuthError('Invalid email or password');
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  if (!isPasswordValid) {
    throw new AuthError('Invalid email or password');
  }

  const tokenPayload: JwtPayload = {
    userId: user.id,
    username: user.username,
  };

  logger.info('Auth', `User logged in: ${user.username} (${user.id})`);

  return {
    user: toPublicProfile(user),
    accessToken: signAccessToken(tokenPayload),
  };
}

/**
 * Refresh an access token using a valid refresh token.
 */
export async function refreshAccessToken(
  refreshToken: string
): Promise<{ accessToken: string }> {
  const payload = verifyToken(refreshToken);

  // Verify user still exists (they might have been deleted)
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  if (!user) {
    throw new AuthError('User no longer exists');
  }

  const newAccessToken = signAccessToken({
    userId: user.id,
    username: user.username,
  });

  return { accessToken: newAccessToken };
}

/**
 * Get the current user's profile from their JWT payload.
 */
export async function getProfile(userId: string): Promise<PublicProfile> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new AuthError('User not found');
  }

  return toPublicProfile(user);
}

/**
 * Generate both access and refresh tokens for a user.
 * Used internally after register/login.
 */
export function generateTokenPair(userId: string, username: string) {
  const payload: JwtPayload = { userId, username };
  return {
    accessToken: signAccessToken(payload),
    refreshToken: signRefreshToken(payload),
  };
}
