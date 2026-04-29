// ─────────────────────────────────────────────────────────
// Game Types — Core game state and move definitions
// ─────────────────────────────────────────────────────────

export type PieceColor = 'w' | 'b';

export type Square = string; // e.g., 'e2', 'e4'

export interface Move {
  from: Square;
  to: Square;
  promotion?: 'q' | 'r' | 'b' | 'n';
}

export type GameStatus =
  | 'WAITING'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'ABANDONED'
  | 'ABORTED';

export type GameResult =
  | 'WHITE_WINS'
  | 'BLACK_WINS'
  | 'DRAW'
  | 'TIMEOUT'
  | 'RESIGNATION'
  | 'ABANDONMENT';

/**
 * The canonical game state — stored in Redis during active games,
 * then persisted to PostgreSQL on completion.
 */
export interface GameState {
  gameId: string;
  fen: string;
  whitePlayerId: string;
  blackPlayerId: string;
  turn: PieceColor;
  status: GameStatus;
  result: GameResult | null;
  whiteTimeMs: number;
  blackTimeMs: number;
  increment: number;    // milliseconds added per move
  timeControl: number;  // initial time in milliseconds
  lastMoveAt: number;   // unix timestamp ms
  pgn: string;
  moveCount: number;
}

/**
 * Lightweight game info sent to the client on game updates.
 */
export interface GameUpdatePayload {
  gameId: string;
  fen: string;
  turn: PieceColor;
  lastMove: Move | null;
  whiteTimeMs: number;
  blackTimeMs: number;
  status: GameStatus;
  pgn: string;
  moveCount: number;
}

export interface GameOverPayload {
  gameId: string;
  result: GameResult;
  winnerId: string | null;
  newElo: number;
  eloChange: number;
  pgn: string;
}

/**
 * Match history entry — fetched via REST API.
 */
export interface GameHistoryEntry {
  id: string;
  whitePlayer: { id: string; username: string; eloRating: number };
  blackPlayer: { id: string; username: string; eloRating: number };
  result: GameResult;
  totalMoves: number;
  playedAt: Date;
}
