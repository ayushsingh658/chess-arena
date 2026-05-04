import * as Sentry from '@sentry/node';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

/**
 * Initializes Sentry for error tracking and performance monitoring.
 * Only active if SENTRY_DSN is provided in the environment.
 */
export function initSentry() {
  if (!env.SENTRY_DSN) {
    logger.info('Sentry', 'Sentry DSN not provided, skipping initialization');
    return;
  }

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: 1.0, // Adjust in production based on volume
  });

  logger.info('Sentry', '✅ Sentry initialized successfully');
}

export { Sentry };
