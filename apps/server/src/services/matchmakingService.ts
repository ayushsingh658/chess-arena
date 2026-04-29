import { redis } from '../config/redis.js';
import { REDIS_KEYS, MATCHMAKING } from '@chess-arena/shared';
import { logger } from '../utils/logger.js';
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

  // Remove any existing entry for this user first
  await removeFromAllQueues(userId);

  // Add to sorted set with Elo as score
  await redis.zadd(queueKey, eloRating, JSON.stringify(entry));

  logger.info(
    'Matchmaking',
    `${username} (${eloRating}) joined queue: ${timeControl.name}`
  );
}

/**
 * Remove a player from all matchmaking queues.
 * Called on cancel, disconnect, or when matched.
 */
export async function removeFromAllQueues(userId: string): Promise<void> {
  // Get all queue keys
  const keys = await redis.keys(`${REDIS_KEYS.MATCHMAKING_QUEUE}:*`);

  for (const key of keys) {
    const members = await redis.zrange(key, 0, -1);
    for (const member of members) {
      try {
        const entry = JSON.parse(member) as QueueEntry;
        if (entry.userId === userId) {
          await redis.zrem(key, member);
          logger.info('Matchmaking', `${entry.username} removed from queue`);
        }
      } catch {
        // Skip malformed entries
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
      if (matched.has(player.userId)) continue;

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
        if (candidate.userId === player.userId) continue;
        if (matched.has(candidate.userId)) continue;

        const eloDiff = Math.abs(player.eloRating - candidate.eloRating);
        if (eloDiff <= eloRange && eloDiff < bestEloDiff) {
          bestOpponent = candidate;
          bestEloDiff = eloDiff;
        }
      }

      if (bestOpponent) {
        matched.add(player.userId);
        matched.add(bestOpponent.userId);

        matches.push({
          player1: player,
          player2: bestOpponent,
          timeControl: player.timeControl,
        });

        // Remove both from queue
        await redis.zrem(queueKey, JSON.stringify(player));
        await redis.zrem(queueKey, JSON.stringify(bestOpponent));

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
