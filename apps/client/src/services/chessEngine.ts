import { Chess } from 'chess.js';
import type { Move } from '@chess-arena/shared';

// ─────────────────────────────────────────────────────────
// Chess AI Engine — Client-Side Only
// ─────────────────────────────────────────────────────────
// A self-contained chess engine with three difficulty levels.
// Uses chess.js for move generation and board evaluation.
//
// Easy:   Random legal moves
// Medium: Greedy capture + piece-value evaluation (depth 1)
// Hard:   Minimax with alpha-beta pruning (depth 3)

export type Difficulty = 'easy' | 'medium' | 'hard';

// ── Piece Values ────────────────────────────────────────

const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// ── Piece-Square Tables (from white's perspective) ──────
// Encourages pieces to occupy strategically strong squares.

const PAWN_TABLE = [
   0,  0,  0,  0,  0,  0,  0,  0,
  50, 50, 50, 50, 50, 50, 50, 50,
  10, 10, 20, 30, 30, 20, 10, 10,
   5,  5, 10, 25, 25, 10,  5,  5,
   0,  0,  0, 20, 20,  0,  0,  0,
   5, -5,-10,  0,  0,-10, -5,  5,
   5, 10, 10,-20,-20, 10, 10,  5,
   0,  0,  0,  0,  0,  0,  0,  0,
];

const KNIGHT_TABLE = [
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,  0,  0,  0,  0,-20,-40,
  -30,  0, 10, 15, 15, 10,  0,-30,
  -30,  5, 15, 20, 20, 15,  5,-30,
  -30,  0, 15, 20, 20, 15,  0,-30,
  -30,  5, 10, 15, 15, 10,  5,-30,
  -40,-20,  0,  5,  5,  0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50,
];

const BISHOP_TABLE = [
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10,  5,  5, 10, 10,  5,  5,-10,
  -10,  0, 10, 10, 10, 10,  0,-10,
  -10, 10, 10, 10, 10, 10, 10,-10,
  -10,  5,  0,  0,  0,  0,  5,-10,
  -20,-10,-10,-10,-10,-10,-10,-20,
];

const ROOK_TABLE = [
   0,  0,  0,  0,  0,  0,  0,  0,
   5, 10, 10, 10, 10, 10, 10,  5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
  -5,  0,  0,  0,  0,  0,  0, -5,
   0,  0,  0,  5,  5,  0,  0,  0,
];

const QUEEN_TABLE = [
  -20,-10,-10, -5, -5,-10,-10,-20,
  -10,  0,  0,  0,  0,  0,  0,-10,
  -10,  0,  5,  5,  5,  5,  0,-10,
   -5,  0,  5,  5,  5,  5,  0, -5,
    0,  0,  5,  5,  5,  5,  0, -5,
  -10,  5,  5,  5,  5,  5,  0,-10,
  -10,  0,  5,  0,  0,  0,  0,-10,
  -20,-10,-10, -5, -5,-10,-10,-20,
];

const KING_TABLE = [
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -10,-20,-20,-20,-20,-20,-20,-10,
   20, 20,  0,  0,  0,  0, 20, 20,
   20, 30, 10,  0,  0, 10, 30, 20,
];

const PST: Record<string, number[]> = {
  p: PAWN_TABLE,
  n: KNIGHT_TABLE,
  b: BISHOP_TABLE,
  r: ROOK_TABLE,
  q: QUEEN_TABLE,
  k: KING_TABLE,
};

// ── Square Index Mapping ────────────────────────────────

function squareToIndex(square: string): number {
  const file = square.charCodeAt(0) - 97; // a=0, h=7
  const rank = 8 - parseInt(square[1]!);   // 8=0, 1=7
  return rank * 8 + file;
}

// ── Board Evaluation ────────────────────────────────────

/**
 * Evaluate the board from the perspective of the side to move.
 * Positive = good for the side to move.
 */
function evaluateBoard(chess: Chess): number {
  if (chess.isCheckmate()) {
    // Current side is checkmated — worst possible score
    return -Infinity;
  }
  if (chess.isDraw() || chess.isStalemate()) {
    return 0;
  }

  let score = 0;
  const board = chess.board();

  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank]![file];
      if (!piece) continue;

      const index = rank * 8 + file;
      // Mirror index for black pieces (PST is from white's perspective)
      const pstIndex = piece.color === 'w' ? index : 63 - index;

      const value = PIECE_VALUES[piece.type]! + (PST[piece.type]?.[pstIndex] ?? 0);

      score += piece.color === 'w' ? value : -value;
    }
  }

  // Return from perspective of side to move
  return chess.turn() === 'w' ? score : -score;
}

// ── AI Move Selection ───────────────────────────────────

/**
 * Get the best move for the current position at the given difficulty.
 */
export function getBestMove(fen: string, difficulty: Difficulty): Move {
  const chess = new Chess(fen);
  const moves = chess.moves({ verbose: true });

  if (moves.length === 0) {
    throw new Error('No legal moves available');
  }

  switch (difficulty) {
    case 'easy':
      return pickRandom(moves);
    case 'medium':
      return pickMedium(chess, moves);
    case 'hard':
      return pickHard(chess);
  }
}

/**
 * Easy: Pure random move selection.
 */
function pickRandom(moves: ReturnType<Chess['moves']>): Move {
  const move = moves[Math.floor(Math.random() * moves.length)]!;
  return toMove(move);
}

/**
 * Medium: Depth-1 evaluation. Prefers captures and good positions,
 * but with some randomness to keep it beatable.
 */
function pickMedium(chess: Chess, moves: ReturnType<Chess['moves']>): Move {
  let bestScore = -Infinity;
  let bestMoves: ReturnType<Chess['moves']> = [];

  for (const move of moves) {
    chess.move(move);
    // Negate because after our move it's opponent's turn
    const score = -evaluateBoard(chess) + (Math.random() * 50 - 25); // Add some noise
    chess.undo();

    if (score > bestScore) {
      bestScore = score;
      bestMoves = [move];
    } else if (score === bestScore) {
      bestMoves.push(move);
    }
  }

  return toMove(bestMoves[Math.floor(Math.random() * bestMoves.length)]!);
}

/**
 * Hard: Minimax with alpha-beta pruning at depth 3.
 */
function pickHard(chess: Chess): Move {
  const depth = 3;
  let bestScore = -Infinity;
  let bestMove: ReturnType<Chess['moves']>[0] | null = null;

  const moves = chess.moves({ verbose: true });
  // Sort moves to improve alpha-beta pruning (captures first)
  moves.sort((a, b) => {
    const aCapture = a.captured ? PIECE_VALUES[a.captured] ?? 0 : 0;
    const bCapture = b.captured ? PIECE_VALUES[b.captured] ?? 0 : 0;
    return bCapture - aCapture;
  });

  for (const move of moves) {
    chess.move(move);
    const score = -minimax(chess, depth - 1, -Infinity, Infinity);
    chess.undo();

    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return toMove(bestMove ?? moves[0]!);
}

/**
 * Minimax with alpha-beta pruning.
 * Returns the evaluation from the perspective of the side to move.
 */
function minimax(
  chess: Chess,
  depth: number,
  alpha: number,
  beta: number,
): number {
  if (depth === 0 || chess.isGameOver()) {
    return evaluateBoard(chess);
  }

  const moves = chess.moves({ verbose: true });

  for (const move of moves) {
    chess.move(move);
    const score = -minimax(chess, depth - 1, -beta, -alpha);
    chess.undo();

    if (score >= beta) {
      return beta; // Beta cutoff
    }
    if (score > alpha) {
      alpha = score;
    }
  }

  return alpha;
}

// ── Helpers ─────────────────────────────────────────────

function toMove(move: { from: string; to: string; promotion?: string }): Move {
  return {
    from: move.from,
    to: move.to,
    promotion: move.promotion as Move['promotion'],
  };
}
