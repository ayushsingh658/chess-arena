import { MATCHMAKING } from '@chess-arena/shared';
import * as matchmakingService from '../services/matchmakingService.js';
import * as gameService from '../services/gameService.js';
import { logger } from '../utils/logger.js';
import type { TypedIO } from '../config/socket.js';

// ─────────────────────────────────────────────────────────
// Matchmaking Worker
// ─────────────────────────────────────────────────────────
// Background process that scans the matchmaking queue every
// second looking for compatible opponents.
//
// This runs as a setInterval, not a separate process, so it
// benefits from shared memory access to the Socket.io instance.
// In a multi-server setup, only ONE server should run this
// worker (use Redis distributed locks or designate a leader).

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Start the matchmaking worker.
 * Scans the queue at the configured interval.
 */
export function startMatchmakingWorker(io: TypedIO): void {
  if (intervalId) {
    logger.warn('MatchmakingWorker', 'Worker already running');
    return;
  }

  logger.info('MatchmakingWorker', `🔄 Started (scanning every ${MATCHMAKING.SCAN_INTERVAL_MS}ms)`);

  intervalId = setInterval(async () => {
    try {
      const matches = await matchmakingService.scanForMatches();

      for (const match of matches) {
        // Create the game in Redis
        const gameState = await gameService.createGame(
          match.player1.userId,
          match.player2.userId,
          match.timeControl
        );

        // Determine colors for each player
        const p1IsWhite = gameState.whitePlayerId === match.player1.userId;

        // Notify player 1
        io.to(match.player1.socketId).emit('match:found', {
          gameId: gameState.gameId,
          color: p1IsWhite ? 'w' : 'b',
          opponent: {
            id: match.player2.userId,
            username: match.player2.username,
            eloRating: match.player2.eloRating,
          },
          timeControl: match.timeControl,
        });

        // Notify player 2
        io.to(match.player2.socketId).emit('match:found', {
          gameId: gameState.gameId,
          color: p1IsWhite ? 'b' : 'w',
          opponent: {
            id: match.player1.userId,
            username: match.player1.username,
            eloRating: match.player1.eloRating,
          },
          timeControl: match.timeControl,
        });

        // Both players join the game room
        const p1Sockets = await io.in(match.player1.socketId).fetchSockets();
        const p2Sockets = await io.in(match.player2.socketId).fetchSockets();

        for (const s of p1Sockets) {
          s.join(`game:${gameState.gameId}`);
        }
        for (const s of p2Sockets) {
          s.join(`game:${gameState.gameId}`);
        }

        logger.info(
          'MatchmakingWorker',
          `🎮 Game ${gameState.gameId} started: ${match.player1.username} vs ${match.player2.username}`
        );
      }
    } catch (err) {
      logger.error('MatchmakingWorker', 'Scan error', err);
    }
  }, MATCHMAKING.SCAN_INTERVAL_MS);
}

/**
 * Stop the matchmaking worker.
 */
export function stopMatchmakingWorker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('MatchmakingWorker', '⏹️ Stopped');
  }
}
