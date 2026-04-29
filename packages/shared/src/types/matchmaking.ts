// ─────────────────────────────────────────────────────────
// Matchmaking Types
// ─────────────────────────────────────────────────────────

export interface TimeControl {
  name: string;
  timeMs: number;     // initial time in milliseconds
  incrementMs: number; // increment per move in milliseconds
}

export interface MatchRequest {
  timeControl: TimeControl;
}

export interface MatchFoundPayload {
  gameId: string;
  color: 'w' | 'b';
  opponent: {
    id: string;
    username: string;
    eloRating: number;
  };
  timeControl: TimeControl;
}

export interface QueueStatusPayload {
  position: number;
  elapsedMs: number;
  estimatedWaitMs: number;
}
