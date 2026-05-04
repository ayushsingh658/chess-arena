import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';

const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
const analysisQueue = new Queue('analysis-queue', { connection });

/**
 * Offloads game analysis to the background worker cluster.
 */
export async function performAutoAnalysis(gameId: string, pgn: string) {
  try {
    logger.info('Analysis', `Pushing game ${gameId} to analysis queue`);
    
    await analysisQueue.add('analyze-game', {
      gameId,
      pgn
    }, {
      removeOnComplete: true,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      }
    });

    logger.info('Analysis', `Game ${gameId} successfully queued for analysis`);
  } catch (err) {
    logger.error('Analysis', `Failed to queue analysis for ${gameId}`, err);
  }
}
