import type { TimeControl } from '../types/matchmaking.js';

// ─────────────────────────────────────────────────────────
// Application Constants
// ─────────────────────────────────────────────────────────

/** Default Glicko-2 rating for new players */
export const DEFAULT_ELO = 1200;
export const DEFAULT_RATING_DEVIATION = 350;
export const DEFAULT_VOLATILITY = 0.06;

/** Matchmaking configuration */
export const MATCHMAKING = {
  /** Initial Elo range to search for opponents */
  INITIAL_ELO_RANGE: 50,
  /** Elo range expansion per interval */
  ELO_RANGE_EXPANSION: 25,
  /** How often to expand the range (milliseconds) */
  EXPANSION_INTERVAL_MS: 5_000,
  /** Maximum Elo range before matching anyone */
  MAX_ELO_RANGE: 200,
  /** How often the matchmaking worker scans the queue */
  SCAN_INTERVAL_MS: 1_000,
} as const;

/** Predefined time controls */
export const TIME_CONTROLS: Record<string, TimeControl> = {
  BULLET_1: { name: 'Bullet 1+0', timeMs: 60_000, incrementMs: 0 },
  BULLET_2: { name: 'Bullet 2+1', timeMs: 120_000, incrementMs: 1_000 },
  BLITZ_3: { name: 'Blitz 3+0', timeMs: 180_000, incrementMs: 0 },
  BLITZ_5: { name: 'Blitz 5+0', timeMs: 300_000, incrementMs: 0 },
  RAPID_10: { name: 'Rapid 10+0', timeMs: 600_000, incrementMs: 0 },
  RAPID_15: { name: 'Rapid 15+10', timeMs: 900_000, incrementMs: 10_000 },
  CLASSICAL_30: { name: 'Classical 30+0', timeMs: 1_800_000, incrementMs: 0 },
} as const;

/** Disconnect grace period before auto-loss */
export const DISCONNECT_TIMEOUT_MS = 30_000;

/** Lag compensation grace (added to clock on each move) */
export const LAG_COMPENSATION_MS = 100;

/** Redis key prefixes */
export const REDIS_KEYS = {
  GAME: 'game:',
  MATCHMAKING_QUEUE: 'matchmaking:queue',
  USER_SOCKET: 'user:socket:',
  USER_ACTIVE_GAME: 'user:active-game:',
} as const;
