import { redis } from '../config/redis.js';
import { REDIS_KEYS } from '@chess-arena/shared';
import * as gameService from '../services/gameService.js';
import { logger } from '../utils/logger.js';
import { ServerEvents } from '@chess-arena/shared';
import type { TypedIO } from '../config/socket.js';

let intervalId: ReturnType<typeof setInterval> | null = null;

/**
 * Start the clock worker to check for timeouts in all active games.
 * Runs every 1 second.
 */
export function startClockWorker(io: TypedIO): void {
  if (intervalId) {
    logger.warn('ClockWorker', 'Worker already running');
    return;
  }

  logger.info('ClockWorker', '⏱️ Started (scanning every 1000ms)');

  intervalId = setInterval(async () => {
    try {
      // Get all active games from Redis
      const keys = await redis.keys(`${REDIS_KEYS.GAME}*`);
      
      for (const key of keys) {
        const gameId = key.replace(REDIS_KEYS.GAME, '');
        
        // checkTimeouts returns the color of the player who timed out, or null
        const timedOutColor = await gameService.checkTimeouts(gameId);
        
        if (timedOutColor) {
          const gameOver = await gameService.handleTimeout(gameId, timedOutColor);
          
          if (gameOver) {
            io.to(`game:${gameId}`).emit(ServerEvents.GAME_OVER, gameOver);
            
            // Clean up sockets from the room
            const sockets = await io.in(`game:${gameId}`).fetchSockets();
            for (const s of sockets) {
              s.leave(`game:${gameId}`);
            }
            
            logger.info('ClockWorker', `⏱️ Game ${gameId} ended by timeout for ${timedOutColor}`);
          }
        }
      }
    } catch (err) {
      logger.error('ClockWorker', 'Scan error', err);
    }
  }, 1000);
}

/**
 * Stop the clock worker.
 */
export function stopClockWorker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('ClockWorker', '⏹️ Stopped');
  }
}
