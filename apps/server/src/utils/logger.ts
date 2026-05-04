import pino from 'pino';
import { env } from '../config/env.js';

// ─────────────────────────────────────────────────────────
// Production-Grade Structured Logger (Pino)
// ─────────────────────────────────────────────────────────
// Pino provides high-performance JSON logging.
// In production, logs are JSON for aggregation (Datadog/Loki).
// In development, pino-pretty makes logs human-readable.

const transport = env.NODE_ENV === 'development'
  ? {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    }
  : undefined;

const pinoLogger = pino({
  level: env.NODE_ENV === 'production' ? 'info' : 'debug',
  transport,
});

/**
 * Wrapper for Pino to maintain compatibility with the existing
 * logger API: logger.info(context, message, data)
 */
export const logger = {
  debug: (ctx: string, msg: string, data?: any) => 
    pinoLogger.debug({ context: ctx, ...data }, msg),
    
  info: (ctx: string, msg: string, data?: any) => 
    pinoLogger.info({ context: ctx, ...data }, msg),
    
  warn: (ctx: string, msg: string, data?: any) => 
    pinoLogger.warn({ context: ctx, ...data }, msg),
    
  error: (ctx: string, msg: string, data?: any) => 
    pinoLogger.error({ context: ctx, ...data }, msg),
};
