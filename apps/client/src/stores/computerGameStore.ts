import { create } from 'zustand';
import { Chess } from 'chess.js';
import { getBestMove, type Difficulty } from '../services/chessEngine';
import type { PieceColor, Move, GameResult } from '@chess-arena/shared';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────
// Computer Game Store (Zustand)
// ─────────────────────────────────────────────────────────
// Manages all state for "Play vs Computer" games.
// Completely separate from the multiplayer gameStore —
// no sockets, no server, no Elo changes.
//
// Game logic runs entirely on the client using chess.js
// for validation and chessEngine.ts for AI moves.

type ComputerGamePhase = 'idle' | 'playing' | 'gameOver';

interface ComputerGameResult {
  result: GameResult;
  winnerId: string | null; // 'player' | 'computer' | null
  pgn: string;
}

interface ComputerGameStore {
  // Phase
  phase: ComputerGamePhase;

  // Game config
  difficulty: Difficulty;
  playerColor: PieceColor;

  // Board state
  fen: string;
  turn: PieceColor;
  pgn: string;
  moveCount: number;
  lastMove: Move | null;
  isThinking: boolean;

  // Result
  gameResult: ComputerGameResult | null;

  // Actions
  startGame: (color: PieceColor, difficulty: Difficulty) => void;
  makeMove: (move: Move) => void;
  resign: () => void;
  resetGame: () => void;
}

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const useComputerGameStore = create<ComputerGameStore>((set, get) => ({
  // Initial state
  phase: 'idle',
  difficulty: 'medium',
  playerColor: 'w',
  fen: STARTING_FEN,
  turn: 'w',
  pgn: '',
  moveCount: 0,
  lastMove: null,
  isThinking: false,
  gameResult: null,

  startGame: (color, difficulty) => {
    set({
      phase: 'playing',
      difficulty,
      playerColor: color,
      fen: STARTING_FEN,
      turn: 'w',
      pgn: '',
      moveCount: 0,
      lastMove: null,
      isThinking: false,
      gameResult: null,
    });

    // If the player chose black, the computer plays first as white
    if (color === 'b') {
      // Small delay so the board renders first
      setTimeout(() => {
        triggerComputerMove(set, get);
      }, 500);
    }
  },

  makeMove: (move) => {
    const { fen, playerColor, turn, phase } = get();

    // Guard: only allow moves during playing phase, on player's turn
    if (phase !== 'playing') return;
    if (turn !== playerColor) return;

    const chess = new Chess(fen);

    // Attempt the move
    const result = chess.move({
      from: move.from,
      to: move.to,
      promotion: move.promotion,
    });

    if (!result) return; // Illegal move — silently reject

    const newFen = chess.fen();
    const newTurn = chess.turn() as PieceColor;
    const newMoveCount = get().moveCount + 1;

    set({
      fen: newFen,
      turn: newTurn,
      pgn: chess.pgn(),
      moveCount: newMoveCount,
      lastMove: move,
    });

    // Check for game end after player's move
    if (chess.isGameOver()) {
      handleGameOver(chess, set, get);
      return;
    }

    // Trigger computer response
    set({ isThinking: true });
    // Add a realistic "thinking" delay based on difficulty
    const delay = getThinkingDelay(get().difficulty);
    setTimeout(() => {
      triggerComputerMove(set, get);
    }, delay);
  },

  resign: () => {
    const { fen } = get();
    const chess = new Chess(fen);
    toast('You resigned', { icon: '🏳️' });
    set({
      phase: 'gameOver',
      gameResult: {
        result: 'RESIGNATION',
        winnerId: 'computer',
        pgn: chess.pgn(),
      },
    });
  },

  resetGame: () => {
    set({
      phase: 'idle',
      fen: STARTING_FEN,
      turn: 'w',
      pgn: '',
      moveCount: 0,
      lastMove: null,
      isThinking: false,
      gameResult: null,
    });
  },
}));

// ── Internal Helpers ────────────────────────────────────

function triggerComputerMove(
  set: (state: Partial<ComputerGameStore>) => void,
  get: () => ComputerGameStore,
): void {
  const { fen, difficulty, phase } = get();

  if (phase !== 'playing') return;

  try {
    const aiMove = getBestMove(fen, difficulty);
    const chess = new Chess(fen);

    const result = chess.move({
      from: aiMove.from,
      to: aiMove.to,
      promotion: aiMove.promotion,
    });

    if (!result) {
      console.error('[AI] Engine returned illegal move', aiMove);
      set({ isThinking: false });
      return;
    }

    set({
      fen: chess.fen(),
      turn: chess.turn() as PieceColor,
      pgn: chess.pgn(),
      moveCount: get().moveCount + 1,
      lastMove: aiMove,
      isThinking: false,
    });

    // Check for game end after computer's move
    if (chess.isGameOver()) {
      handleGameOver(chess, set, get);
    }
  } catch (err) {
    console.error('[AI] Error computing move:', err);
    set({ isThinking: false });
  }
}

function handleGameOver(
  chess: Chess,
  set: (state: Partial<ComputerGameStore>) => void,
  get: () => ComputerGameStore,
): void {
  const { playerColor } = get();
  let result: GameResult;
  let winnerId: string | null = null;

  if (chess.isCheckmate()) {
    // The side whose turn it is got checkmated
    const loserColor = chess.turn();
    if (loserColor === playerColor) {
      result = playerColor === 'w' ? 'BLACK_WINS' : 'WHITE_WINS';
      winnerId = 'computer';
    } else {
      result = playerColor === 'w' ? 'WHITE_WINS' : 'BLACK_WINS';
      winnerId = 'player';
    }
  } else {
    // Draw (stalemate, insufficient material, repetition, 50-move)
    result = 'DRAW';
    winnerId = null;
  }

  toast('Game Over', { icon: '🏁' });

  set({
    phase: 'gameOver',
    gameResult: {
      result,
      winnerId,
      pgn: chess.pgn(),
    },
  });
}

function getThinkingDelay(difficulty: Difficulty): number {
  switch (difficulty) {
    case 'easy':
      return 300 + Math.random() * 300;
    case 'medium':
      return 400 + Math.random() * 400;
    case 'hard':
      return 500 + Math.random() * 500;
  }
}
