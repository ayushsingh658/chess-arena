import { Redis } from 'ioredis';
import { env } from './env.js';

// ─────────────────────────────────────────────────────────
// Redis Client Factory
// ─────────────────────────────────────────────────────────
// We create separate clients for pub/sub and general commands
// because Redis pub/sub mode locks a connection — it can't
// run regular commands while subscribed.

/**
 * Create a new Redis client instance.
 * Each caller gets its own connection for isolation.
 */
export function createRedisClient(name: string): Redis {
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 200, 5000);
      console.log(`[Redis:${name}] Retry attempt ${times}, waiting ${delay}ms`);
      return delay;
    },
    lazyConnect: false,
  });

  client.on('connect', () => {
    console.log(`[Redis:${name}] ✅ Connected`);
  });

  client.on('error', (err) => {
    console.error(`[Redis:${name}] ❌ Error:`, err.message);
  });

  return client;
}

/** General-purpose Redis client for game state, matchmaking, etc. */
export const redis = createRedisClient('main');
