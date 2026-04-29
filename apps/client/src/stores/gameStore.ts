import { create } from 'zustand';
import { getSocket } from '../services/socket';
import {
  ClientEvents,
  ServerEvents,
  type GameUpdatePayload,
  type GameOverPayload,
  type MatchFoundPayload,
  type TimeControl,
  type PieceColor,
  type Move,
} from '@chess-arena/shared';

// ─────────────────────────────────────────────────────────
// Game Store (Zustand)
// ─────────────────────────────────────────────────────────
// Central state for the entire game lifecycle:
// Idle → Searching → Playing → GameOver

type GamePhase = 'idle' | 'searching' | 'playing' | 'gameOver';

interface GameStore {
  // Phase
  phase: GamePhase;

  // Matchmaking
  searchTimeMs: number;

  // Game state
  gameId: string | null;
  fen: string;
  turn: PieceColor;
  playerColor: PieceColor | null;
  opponentName: string | null;
  opponentRating: number | null;
  whiteTimeMs: number;
  blackTimeMs: number;
  pgn: string;
  moveCount: number;
  lastMove: Move | null;

  // Game over
  gameResult: GameOverPayload | null;

  // Opponent status
  opponentDisconnected: boolean;
  disconnectTimeoutMs: number;

  // Actions
  findMatch: (timeControl: TimeControl) => void;
  cancelMatch: () => void;
  makeMove: (move: Move) => void;
  resign: () => void;
  resetGame: () => void;

  // Socket listener setup
  initSocketListeners: () => void;
  cleanupSocketListeners: () => void;

  // Internal
  _setSearchTimer: (interval: ReturnType<typeof setInterval> | null) => void;
  _searchInterval: ReturnType<typeof setInterval> | null;
}

export const useGameStore = create<GameStore>((set, get) => ({
  // Initial state
  phase: 'idle',
  searchTimeMs: 0,
  gameId: null,
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  turn: 'w',
  playerColor: null,
  opponentName: null,
  opponentRating: null,
  whiteTimeMs: 0,
  blackTimeMs: 0,
  pgn: '',
  moveCount: 0,
  lastMove: null,
  gameResult: null,
  opponentDisconnected: false,
  disconnectTimeoutMs: 0,
  _searchInterval: null,

  findMatch: (timeControl) => {
    const socket = getSocket();
    if (!socket) return;

    socket.emit(ClientEvents.FIND_MATCH, { timeControl });

    // Start search timer
    const startTime = Date.now();
    const interval = setInterval(() => {
      set({ searchTimeMs: Date.now() - startTime });
    }, 100);

    set({
      phase: 'searching',
      searchTimeMs: 0,
    });
    get()._setSearchTimer(interval);
  },

  cancelMatch: () => {
    const socket = getSocket();
    if (!socket) return;

    socket.emit(ClientEvents.CANCEL_MATCH);

    const interval = get()._searchInterval;
    if (interval) clearInterval(interval);

    set({
      phase: 'idle',
      searchTimeMs: 0,
      _searchInterval: null,
    });
  },

  makeMove: (move) => {
    const socket = getSocket();
    const { gameId } = get();
    if (!socket || !gameId) return;

    socket.emit(ClientEvents.MOVE_REQUEST, { gameId, move });
  },

  resign: () => {
    const socket = getSocket();
    const { gameId } = get();
    if (!socket || !gameId) return;

    socket.emit(ClientEvents.RESIGN, { gameId });
  },

  resetGame: () => {
    const interval = get()._searchInterval;
    if (interval) clearInterval(interval);

    set({
      phase: 'idle',
      searchTimeMs: 0,
      gameId: null,
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      turn: 'w',
      playerColor: null,
      opponentName: null,
      opponentRating: null,
      whiteTimeMs: 0,
      blackTimeMs: 0,
      pgn: '',
      moveCount: 0,
      lastMove: null,
      gameResult: null,
      opponentDisconnected: false,
      disconnectTimeoutMs: 0,
      _searchInterval: null,
    });
  },

  initSocketListeners: () => {
    const socket = getSocket();
    if (!socket) return;

    // Match found
    socket.on(ServerEvents.MATCH_FOUND, (payload: MatchFoundPayload) => {
      const interval = get()._searchInterval;
      if (interval) clearInterval(interval);

      set({
        phase: 'playing',
        gameId: payload.gameId,
        playerColor: payload.color,
        opponentName: payload.opponent.username,
        opponentRating: payload.opponent.eloRating,
        whiteTimeMs: payload.timeControl.timeMs,
        blackTimeMs: payload.timeControl.timeMs,
        searchTimeMs: 0,
        _searchInterval: null,
      });
    });

    // Game update (new move from server)
    socket.on(ServerEvents.GAME_UPDATE, (payload: GameUpdatePayload) => {
      set({
        fen: payload.fen,
        turn: payload.turn,
        lastMove: payload.lastMove,
        whiteTimeMs: payload.whiteTimeMs,
        blackTimeMs: payload.blackTimeMs,
        pgn: payload.pgn,
        moveCount: payload.moveCount,
      });
    });

    // Move rejected
    socket.on(ServerEvents.MOVE_REJECTED, (payload) => {
      console.warn('[Game] Move rejected:', payload.reason);
      // The board will snap back since we didn't update the FEN
    });

    // Game over
    socket.on(ServerEvents.GAME_OVER, (payload: GameOverPayload) => {
      set({
        phase: 'gameOver',
        gameResult: payload,
        opponentDisconnected: false,
      });
    });

    // Opponent disconnected
    socket.on(ServerEvents.OPPONENT_DISCONNECTED, (payload) => {
      set({
        opponentDisconnected: true,
        disconnectTimeoutMs: payload.timeoutMs,
      });
    });

    // Opponent reconnected
    socket.on(ServerEvents.OPPONENT_RECONNECTED, () => {
      set({ opponentDisconnected: false });
    });

    // Reconnect to active game
    socket.emit(ClientEvents.RECONNECT_GAME);
  },

  cleanupSocketListeners: () => {
    const socket = getSocket();
    if (!socket) return;

    socket.off(ServerEvents.MATCH_FOUND);
    socket.off(ServerEvents.GAME_UPDATE);
    socket.off(ServerEvents.MOVE_REJECTED);
    socket.off(ServerEvents.GAME_OVER);
    socket.off(ServerEvents.OPPONENT_DISCONNECTED);
    socket.off(ServerEvents.OPPONENT_RECONNECTED);
  },

  _setSearchTimer: (interval) => {
    set({ _searchInterval: interval });
  },
}));
