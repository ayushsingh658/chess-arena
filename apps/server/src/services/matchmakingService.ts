import { redis } from '../config/redis.js';
import { REDIS_KEYS, MATCHMAKING } from '@chess-arena/shared';
import { logger } from '../utils/logger.js';
import { env } from '../config/env.js';
import type { TimeControl } from '@chess-arena/shared';

// ─────────────────────────────────────────────────────────
// Matchmaking Service
// ─────────────────────────────────────────────────────────
// Uses a Redis Sorted Set where the SCORE is the player's
// Elo rating. This allows O(log N) range queries to find
// nearby-rated opponents — the same approach used by
// Chess.com and Lichess for fast matchmaking.

/**
 * Entry stored in the matchmaking queue.
 * Serialized as JSON in the sorted set member.
 */
interface QueueEntry {
  userId: string;
  username: string;
  socketId: string;
  eloRating: number;
  timeControl: TimeControl;
  joinedAt: number; // unix timestamp ms
}

/**
 * Result of a successful match between two players.
 */
export interface MatchResult {
  player1: QueueEntry;
  player2: QueueEntry;
  timeControl: TimeControl;
}

/**
 * Add a player to the matchmaking queue.
 * Uses their Elo as the score for range-based matching.
 */
export async function joinQueue(
  userId: string,
  username: string,
  socketId: string,
  eloRating: number,
  timeControl: TimeControl
): Promise<void> {
  const entry: QueueEntry = {
    userId,
    username,
    socketId,
    eloRating,
    timeControl,
    joinedAt: Date.now(),
  };

  // Use a composite key so the same user can't queue twice
  const queueKey = `${REDIS_KEYS.MATCHMAKING_QUEUE}:${timeControl.name}`;

  // Remove any existing entry for this specific socket first
  await removeSocketFromAllQueues(socketId);
  
  // If self-match is disabled, also ensure no other tabs for this user are queueing
  if (!env.ALLOW_SELF_MATCH) {
    await removeUserFromAllQueues(userId);
  }

  // Add to sorted set with Elo as score
  await redis.zadd(queueKey, eloRating, JSON.stringify(entry));

  logger.info(
    'Matchmaking',
    `${username} (${eloRating}) joined queue: ${timeControl.name}`
  );
}

/**
 * Remove a specific socket from all matchmaking queues.
 */
export async function removeSocketFromAllQueues(socketId: string): Promise<void> {
  const keys = await redis.keys(`${REDIS_KEYS.MATCHMAKING_QUEUE}:*`);

  for (const key of keys) {
    const members = await redis.zrange(key, 0, -1);
    for (const member of members) {
      try {
        const entry = JSON.parse(member) as QueueEntry;
        if (entry.socketId === socketId) {
          await redis.zrem(key, member);
          logger.info('Matchmaking', `${entry.username} (socket:${socketId}) removed from queue`);
        }
      } catch {
        // Skip
      }
    }
  }
}

/**
 * Remove all entries for a user from all matchmaking queues.
 * Used for hard resets or when self-matching is disabled.
 */
export async function removeUserFromAllQueues(userId: string): Promise<void> {
  const keys = await redis.keys(`${REDIS_KEYS.MATCHMAKING_QUEUE}:*`);

  for (const key of keys) {
    const members = await redis.zrange(key, 0, -1);
    for (const member of members) {
      try {
        const entry = JSON.parse(member) as QueueEntry;
        if (entry.userId === userId) {
          await redis.zrem(key, member);
        }
      } catch {
        // Skip
      }
    }
  }
}

/**
 * Scan the queue for potential matches.
 *
 * Algorithm:
 * 1. Get all players in the queue, sorted by Elo
 * 2. For each unmatched player (oldest first):
 *    a. Calculate the Elo search range based on wait time
 *    b. Find nearest opponent within range
 *    c. If found, create a match
 *
 * The Elo range expands over time:
 *   - Start: ±50 Elo
 *   - Every 5s: expand by ±25
 *   - Max: ±200 Elo (after 30s)
 *
 * This ensures fast matches for populated Elo brackets
 * while still finding matches for outliers after waiting.
 */
export async function scanForMatches(): Promise<MatchResult[]> {
  const keys = await redis.keys(`${REDIS_KEYS.MATCHMAKING_QUEUE}:*`);
  const matches: MatchResult[] = [];

  for (const queueKey of keys) {
    // Get all members with scores (Elo ratings)
    const membersWithScores = await redis.zrange(queueKey, 0, -1, 'WITHSCORES');

    // Parse into entries (members come as [member, score, member, score, ...])
    const entries: QueueEntry[] = [];
    for (let i = 0; i < membersWithScores.length; i += 2) {
      try {
        const entry = JSON.parse(membersWithScores[i]!) as QueueEntry;
        entries.push(entry);
      } catch {
        // Skip malformed entries
      }
    }

    if (entries.length < 2) continue;

    // Sort by join time (oldest first — they've waited longest)
    entries.sort((a, b) => a.joinedAt - b.joinedAt);

      const matched = new Set<string>();

    for (const player of entries) {
      if (matched.has(player.socketId)) continue;

      const now = Date.now();
      const waitTimeMs = now - player.joinedAt;

      // Calculate dynamic Elo range based on wait time
      const expansions = Math.floor(waitTimeMs / MATCHMAKING.EXPANSION_INTERVAL_MS);
      const eloRange = Math.min(
        MATCHMAKING.INITIAL_ELO_RANGE + expansions * MATCHMAKING.ELO_RANGE_EXPANSION,
        MATCHMAKING.MAX_ELO_RANGE
      );

      // Find best opponent within range
      let bestOpponent: QueueEntry | null = null;
      let bestEloDiff = Infinity;

      for (const candidate of entries) {
        // Don't match with yourself unless specifically allowed in dev
        if (candidate.userId === player.userId) {
          if (!env.ALLOW_SELF_MATCH) continue;
          // Even if self-matching is allowed, don't match the SAME tab
          if (candidate.socketId === player.socketId) continue;
        }
        
        if (matched.has(candidate.socketId)) continue;

        const eloDiff = Math.abs(player.eloRating - candidate.eloRating);
        if (eloDiff <= eloRange && eloDiff < bestEloDiff) {
          bestOpponent = candidate;
          bestEloDiff = eloDiff;
        }
      }

      if (bestOpponent) {
        matched.add(player.socketId);
        matched.add(bestOpponent.socketId);

        matches.push({
          player1: player,
          player2: bestOpponent,
          timeControl: player.timeControl,
        });

        // Remove both from queue
        await removeSocketFromAllQueues(player.socketId);
        await removeSocketFromAllQueues(bestOpponent.socketId);

        logger.info(
          'Matchmaking',
          `✅ Match found: ${player.username} (${player.eloRating}) vs ${bestOpponent.username} (${bestOpponent.eloRating}) | Δ${bestEloDiff} Elo`
        );
      }
    }
  }

  return matches;
}

/**
 * Get the current queue size for a specific time control.
 */
export async function getQueueSize(timeControlName: string): Promise<number> {
  const key = `${REDIS_KEYS.MATCHMAKING_QUEUE}:${timeControlName}`;
  return redis.zcard(key);
}

/**
 * Get a player's position in the queue.
 * Returns null if the player is not in any queue.
 */
export async function getQueuePosition(userId: string): Promise<{
  position: number;
  total: number;
  elapsedMs: number;
} | null> {
  const keys = await redis.keys(`${REDIS_KEYS.MATCHMAKING_QUEUE}:*`);

  for (const key of keys) {
    const members = await redis.zrange(key, 0, -1);
    for (let i = 0; i < members.length; i++) {
      try {
        const entry = JSON.parse(members[i]!) as QueueEntry;
        if (entry.userId === userId) {
          return {
            position: i + 1,
            total: members.length,
            elapsedMs: Date.now() - entry.joinedAt,
          };
        }
      } catch {
        // Skip malformed
      }
    }
  }

  return null;
}
