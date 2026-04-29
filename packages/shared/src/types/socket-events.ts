import type { Move } from './game.js';
import type { MatchRequest, MatchFoundPayload, QueueStatusPayload } from './matchmaking.js';
import type { GameUpdatePayload, GameOverPayload } from './game.js';

// ─────────────────────────────────────────────────────────
// Socket Event Names — Single source of truth
// ─────────────────────────────────────────────────────────
// Using string literal constants instead of enums for better
// tree-shaking and Socket.io event name compatibility.

/**
 * Events emitted from Client → Server
 */
export const ClientEvents = {
  FIND_MATCH: 'match:find',
  CANCEL_MATCH: 'match:cancel',
  MOVE_REQUEST: 'game:move',
  RESIGN: 'game:resign',
  OFFER_DRAW: 'game:draw:offer',
  RESPOND_DRAW: 'game:draw:respond',
  RECONNECT_GAME: 'game:reconnect',
} as const;

/**
 * Events emitted from Server → Client
 */
export const ServerEvents = {
  MATCH_FOUND: 'match:found',
  QUEUE_STATUS: 'match:queue-status',
  GAME_UPDATE: 'game:update',
  MOVE_REJECTED: 'game:move-rejected',
  GAME_OVER: 'game:over',
  OPPONENT_DISCONNECTED: 'game:opponent-disconnected',
  OPPONENT_RECONNECTED: 'game:opponent-reconnected',
  ERROR: 'game:error',
} as const;

// ─────────────────────────────────────────────────────────
// Typed Event Payloads — Ensures type safety on both ends
// ─────────────────────────────────────────────────────────

/**
 * Type map for events the CLIENT sends to the SERVER.
 * Used to type the Socket.io emit() calls on the client
 * and the on() handlers on the server.
 */
export interface ClientToServerEvents {
  [ClientEvents.FIND_MATCH]: (payload: MatchRequest) => void;
  [ClientEvents.CANCEL_MATCH]: () => void;
  [ClientEvents.MOVE_REQUEST]: (payload: { gameId: string; move: Move }) => void;
  [ClientEvents.RESIGN]: (payload: { gameId: string }) => void;
  [ClientEvents.OFFER_DRAW]: (payload: { gameId: string }) => void;
  [ClientEvents.RESPOND_DRAW]: (payload: { gameId: string; accept: boolean }) => void;
  [ClientEvents.RECONNECT_GAME]: () => void;
}

/**
 * Type map for events the SERVER sends to the CLIENT.
 * Used to type the emit() calls on the server
 * and the on() handlers on the client.
 */
export interface ServerToClientEvents {
  [ServerEvents.MATCH_FOUND]: (payload: MatchFoundPayload) => void;
  [ServerEvents.QUEUE_STATUS]: (payload: QueueStatusPayload) => void;
  [ServerEvents.GAME_UPDATE]: (payload: GameUpdatePayload) => void;
  [ServerEvents.MOVE_REJECTED]: (payload: { reason: string }) => void;
  [ServerEvents.GAME_OVER]: (payload: GameOverPayload) => void;
  [ServerEvents.OPPONENT_DISCONNECTED]: (payload: { timeoutMs: number }) => void;
  [ServerEvents.OPPONENT_RECONNECTED]: () => void;
  [ServerEvents.ERROR]: (payload: { message: string; code: string }) => void;
}

/**
 * Inter-server events for Socket.io Redis adapter communication.
 */
export interface InterServerEvents {
  ping: () => void;
}

/**
 * Per-socket data attached during the handshake.
 */
export interface SocketData {
  userId: string;
  username: string;
}
