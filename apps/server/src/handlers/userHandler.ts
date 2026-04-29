import { Router } from 'express';
import { prisma } from '../config/database.js';
import { requireAuth } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

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

    res.json({ players: topPlayers });
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
