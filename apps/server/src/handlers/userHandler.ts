import { Router } from 'express';
import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import { requireAuth } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';
import { REDIS_KEYS } from '@chess-arena/shared';

export const userRouter = Router();

// ─────────────────────────────────────────────────────────
// User Routes
// ─────────────────────────────────────────────────────────

/**
 * GET /users/leaderboard
 * Fetch the top 50 players by Elo rating
 */
userRouter.get('/leaderboard', async (_req, res) => {
  try {
    // 1. Try to fetch from Redis cache first
    const cachedLeaderboard = await redis.get(REDIS_KEYS.LEADERBOARD || 'leaderboard');
    if (cachedLeaderboard) {
      return res.json({ players: JSON.parse(cachedLeaderboard), cached: true });
    }

    // 2. Fallback to Prisma if cache is empty
    const topPlayers = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        eloRating: true,
        gamesPlayed: true,
        wins: true,
        losses: true,
        draws: true,
      },
      orderBy: {
        eloRating: 'desc',
      },
      take: 50,
    });

    // 3. Update Redis cache with 5-minute TTL
    await redis.setex(
      REDIS_KEYS.LEADERBOARD || 'leaderboard',
      300, // 5 minutes
      JSON.stringify(topPlayers)
    );

    res.json({ players: topPlayers, cached: false });
  } catch (error) {
    logger.error('UserHandler', 'Error fetching leaderboard', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

/**
 * GET /users/me/history
 * Fetch the authenticated user's game history
 */
userRouter.get('/me/history', requireAuth, async (req, res) => {
  try {
    const userId = req.user!.userId;

    const games = await prisma.game.findMany({
      where: {
        OR: [{ whitePlayerId: userId }, { blackPlayerId: userId }],
      },
      orderBy: {
        playedAt: 'desc',
      },
      take: 20,
      include: {
        whitePlayer: {
          select: { id: true, username: true, eloRating: true },
        },
        blackPlayer: {
          select: { id: true, username: true, eloRating: true },
        },
      },
    });

    res.json({ games });
  } catch (error) {
    logger.error('UserHandler', 'Error fetching game history', error);
    res.status(500).json({ error: 'Failed to fetch game history' });
  }
});

/**
 * GET /users/games/:id
 * Fetch details of a specific game for review
 */
userRouter.get('/games/:id', requireAuth, async (req, res) => {
  try {
    const gameId = req.params.id as string;
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        whitePlayer: { select: { id: true, username: true, eloRating: true } },
        blackPlayer: { select: { id: true, username: true, eloRating: true } },
      },
    });

    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    res.json({ game });
  } catch (error) {
    logger.error('UserHandler', `Error fetching game ${req.params.id}`, error);
    res.status(500).json({ error: 'Failed to fetch game details' });
  }
});
