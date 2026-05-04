import { create } from 'zustand';
import { getSocket } from '../services/socket';
import { toast } from 'react-hot-toast';
import { soundService } from '../services/soundService';
import {
  ClientEvents,
  ServerEvents,
  type GameUpdatePayload,
  type GameOverPayload,
  type MatchFoundPayload,
  type TimeControl,
  type PieceColor,
  type Move,
  type ChatMessage,
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
  isSpectating: boolean;

  // Matchmaking
  searchTimeMs: number;

  // Game state
  gameId: string | null;
  fen: string;
  turn: PieceColor;
  playerColor: PieceColor | null;
  opponentName: string | null;
  opponentRating: number | null;
  whitePlayerName: string | null;
  whitePlayerRating: number | null;
  blackPlayerName: string | null;
  blackPlayerRating: number | null;
  whiteTimeMs: number;
  blackTimeMs: number;
  pgn: string;
  moveCount: number;
  lastMove: Move | null;
  evaluation: number; // Centipawns

  // Game over
  gameResult: GameOverPayload | null;

  // Opponent status
  opponentDisconnected: boolean;
  disconnectTimeoutMs: number;

  // Chat
  messages: ChatMessage[];

  // Actions
  findMatch: (timeControl: TimeControl) => void;
  cancelMatch: () => void;
  makeMove: (move: Move) => void;
  resign: () => void;
  resetGame: () => void;
  sendChat: (content: string) => void;
  spectateGame: (gameId: string, white: any, black: any) => void;

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
  whitePlayerName: null,
  whitePlayerRating: null,
  blackPlayerName: null,
  blackPlayerRating: null,
  whiteTimeMs: 0,
  blackTimeMs: 0,
  pgn: '',
  moveCount: 0,
  lastMove: null,
  evaluation: 0,
  gameResult: null,
  opponentDisconnected: false,
  disconnectTimeoutMs: 0,
  isSpectating: false,
  messages: [],
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

  sendChat: (content) => {
    const socket = getSocket();
    const { gameId } = get();
    if (!socket || !gameId) return;

    socket.emit(ClientEvents.SEND_CHAT, { gameId, content });
  },

  spectateGame: (gameId, white, black) => {
    const socket = getSocket();
    if (!socket) return;

    socket.emit(ClientEvents.SPECTATE_GAME, { gameId });

    set({
      phase: 'playing',
      isSpectating: true,
      gameId,
      playerColor: null,
      whitePlayerName: white.username,
      whitePlayerRating: white.eloRating,
      blackPlayerName: black.username,
      blackPlayerRating: black.eloRating,
      opponentName: black.username,
      opponentRating: black.eloRating,
      messages: [],
    });
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
      evaluation: 0,
      gameResult: null,
      opponentDisconnected: false,
      disconnectTimeoutMs: 0,
      isSpectating: false,
      messages: [],
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

      toast.success('Opponent found! Game starting...', { icon: '⚔️' });

      set({
        phase: 'playing',
        gameId: payload.gameId,
        playerColor: payload.color,
        opponentName: payload.opponent.username,
        opponentRating: payload.opponent.eloRating,
        whitePlayerName: payload.color === 'w' ? 'You' : payload.opponent.username,
        blackPlayerName: payload.color === 'b' ? 'You' : payload.opponent.username,
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
        pgn: payload.pgn,
        turn: payload.turn,
        lastMove: payload.lastMove,
        moveCount: payload.moveCount,
        whiteTimeMs: payload.whiteTimeMs,
        blackTimeMs: payload.blackTimeMs,
      });

      // Play sound based on move type
      if (payload.lastMove) {
        const isCapture = (payload.lastMove as any).captured;
        const isCheck = payload.pgn.includes('+') || payload.pgn.includes('#');
        
        if (isCheck) soundService.play('check');
        else if (isCapture) soundService.play('capture');
        else soundService.play('move');
      }
    });

    // Move rejected
    socket.on(ServerEvents.MOVE_REJECTED, (payload) => {
      console.warn('[Game] Move rejected:', payload.reason);
      toast.error(payload.reason);
      // The board will snap back since we didn't update the FEN
    });

    // Game over
    socket.on(ServerEvents.GAME_OVER, (payload: GameOverPayload) => {
      set({ 
        phase: 'gameOver',
        gameResult: payload,
        opponentDisconnected: false,
      });
      soundService.play('gameEnd');
      if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
      toast('Game Over', { icon: '🏁' });
    });

    // Opponent disconnected
    socket.on(ServerEvents.OPPONENT_DISCONNECTED, (payload) => {
      toast.error('Opponent disconnected! Waiting for them to return...', { icon: '⚠️' });
      set({
        opponentDisconnected: true,
        disconnectTimeoutMs: payload.timeoutMs,
      });
    });

    // Opponent reconnected
    socket.on(ServerEvents.OPPONENT_RECONNECTED, () => {
      toast.success('Opponent reconnected!', { icon: '🔌' });
      set({ opponentDisconnected: false });
    });

    // Chat message
    socket.on(ServerEvents.CHAT_MESSAGE, (payload: ChatMessage) => {
      set((state) => ({
        messages: [...state.messages, payload],
      }));
    });

    // Game evaluation
    socket.on(ServerEvents.GAME_EVALUATION, (payload) => {
      if (payload.gameId === get().gameId) {
        set({ evaluation: payload.score });
      }
    });

    // Reconnect to active game on initial load AND every reconnection
    const handleConnect = () => {
      socket.emit(ClientEvents.RECONNECT_GAME);
    };

    socket.on('connect', handleConnect);
    
    // Also trigger it immediately if already connected
    if (socket.connected) {
      handleConnect();
    }
  },

  cleanupSocketListeners: () => {
    const socket = getSocket();
    if (!socket) return;

    socket.off('connect');
    socket.off(ServerEvents.MATCH_FOUND);
    socket.off(ServerEvents.GAME_UPDATE);
    socket.off(ServerEvents.MOVE_REJECTED);
    socket.off(ServerEvents.GAME_OVER);
    socket.off(ServerEvents.OPPONENT_DISCONNECTED);
    socket.off(ServerEvents.OPPONENT_RECONNECTED);
    socket.off(ServerEvents.CHAT_MESSAGE);
    socket.off(ServerEvents.GAME_EVALUATION);
  },

  _setSearchTimer: (interval) => {
    set({ _searchInterval: interval });
  },
}));
