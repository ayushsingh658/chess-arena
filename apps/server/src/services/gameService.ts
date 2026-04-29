import { Chess } from 'chess.js';
import { redis } from '../config/redis.js';
import { prisma } from '../config/database.js';
import { REDIS_KEYS } from '@chess-arena/shared';
import { GameError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type {
  GameState,
  GameStatus,
  GameResult,
  Move,
  PieceColor,
  TimeControl,
  GameUpdatePayload,
  GameOverPayload,
} from '@chess-arena/shared';

// ─────────────────────────────────────────────────────────
// Game Service
// ─────────────────────────────────────────────────────────
// The AUTHORITATIVE SERVER for all game logic.
// The client NEVER dictates game state — it only sends
// MOVE_REQUEST events. This service validates every move
// using chess.js before broadcasting the result.
//
// Active game state lives in Redis for sub-millisecond reads.
// Completed games are persisted to PostgreSQL for durability.

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

/**
 * Create a new game between two matched players.
 * Randomly assigns white/black and initializes the board.
 */
export async function createGame(
  player1Id: string,
  player2Id: string,
  timeControl: TimeControl
): Promise<GameState> {
  // Randomly assign colors
  const isPlayer1White = Math.random() > 0.5;
  const whitePlayerId = isPlayer1White ? player1Id : player2Id;
  const blackPlayerId = isPlayer1White ? player2Id : player1Id;

  const gameId = generateGameId();

  const gameState: GameState = {
    gameId,
    fen: STARTING_FEN,
    whitePlayerId,
    blackPlayerId,
    turn: 'w',
    status: 'ACTIVE' as GameStatus,
    result: null,
    whiteTimeMs: timeControl.timeMs,
    blackTimeMs: timeControl.timeMs,
    increment: timeControl.incrementMs,
    timeControl: timeControl.timeMs,
    lastMoveAt: Date.now(),
    pgn: '',
    moveCount: 0,
  };

  // Store in Redis with 2-hour TTL (games shouldn't last longer)
  const key = `${REDIS_KEYS.GAME}${gameId}`;
  await redis.set(key, JSON.stringify(gameState), 'EX', 7200);

  // Map both players to this active game (for reconnection)
  await redis.set(
    `${REDIS_KEYS.USER_ACTIVE_GAME}${whitePlayerId}`,
    gameId,
    'EX',
    7200
  );
  await redis.set(
    `${REDIS_KEYS.USER_ACTIVE_GAME}${blackPlayerId}`,
    gameId,
    'EX',
    7200
  );

  logger.info(
    'Game',
    `🎮 Game ${gameId} created: white=${whitePlayerId} vs black=${blackPlayerId}`
  );

  return gameState;
}

/**
 * Attempt a move on the board.
 *
 * This is the core authoritative validation:
 * 1. Verify it's the requesting player's turn
 * 2. Load current FEN into chess.js
 * 3. Attempt the move
 * 4. If illegal → reject
 * 5. If legal → update state, check for game end
 */
export async function makeMove(
  gameId: string,
  userId: string,
  move: Move
): Promise<{
  gameUpdate: GameUpdatePayload;
  gameOver: GameOverPayload | null;
}> {
  const state = await getGameState(gameId);

  if (!state) {
    throw new GameError('Game not found', 'GAME_NOT_FOUND');
  }

  if (state.status !== 'ACTIVE') {
    throw new GameError('Game is not active', 'GAME_NOT_ACTIVE');
  }

  // Verify it's this player's turn
  const isWhite = state.whitePlayerId === userId;
  const isBlack = state.blackPlayerId === userId;

  if (!isWhite && !isBlack) {
    throw new GameError('You are not a player in this game', 'NOT_A_PLAYER');
  }

  if ((state.turn === 'w' && !isWhite) || (state.turn === 'b' && !isBlack)) {
    throw new GameError('It is not your turn', 'NOT_YOUR_TURN');
  }

  // Load position into chess.js and attempt the move
  const chess = new Chess(state.fen);

  const result = chess.move({
    from: move.from,
    to: move.to,
    promotion: move.promotion,
  });

  if (!result) {
    throw new GameError('Illegal move', 'ILLEGAL_MOVE');
  }

  // ── Update clocks ────────────────────────────────────
  const now = Date.now();
  const rawElapsed = now - state.lastMoveAt;
  const elapsed = Math.max(0, rawElapsed - 100); // 100ms standard lag compensation

  if (state.turn === 'w') {
    state.whiteTimeMs = Math.max(0, state.whiteTimeMs - elapsed + state.increment);
  } else {
    state.blackTimeMs = Math.max(0, state.blackTimeMs - elapsed + state.increment);
  }

  // ── Update game state ────────────────────────────────
  state.fen = chess.fen();
  state.turn = chess.turn() as PieceColor;
  state.lastMoveAt = now;
  state.moveCount += 1;
  state.pgn = chess.pgn();

  // ── Check for game end ───────────────────────────────
  let gameOver: GameOverPayload | null = null;

  if (chess.isCheckmate()) {
    const winnerId = state.turn === 'w' ? state.blackPlayerId : state.whitePlayerId;
    const gameResult: GameResult = state.turn === 'w' ? 'BLACK_WINS' : 'WHITE_WINS';
    gameOver = await endGame(state, gameResult, winnerId);
  } else if (chess.isDraw() || chess.isStalemate() || chess.isThreefoldRepetition() || chess.isInsufficientMaterial()) {
    gameOver = await endGame(state, 'DRAW' as GameResult, null);
  } else {
    // Game continues — save updated state
    const key = `${REDIS_KEYS.GAME}${gameId}`;
    await redis.set(key, JSON.stringify(state), 'EX', 7200);
  }

  const gameUpdate: GameUpdatePayload = {
    gameId: state.gameId,
    fen: state.fen,
    turn: state.turn,
    lastMove: move,
    whiteTimeMs: state.whiteTimeMs,
    blackTimeMs: state.blackTimeMs,
    status: state.status,
    pgn: state.pgn,
    moveCount: state.moveCount,
  };

  return { gameUpdate, gameOver };
}

/**
 * Handle a player resigning.
 */
export async function resign(
  gameId: string,
  userId: string
): Promise<GameOverPayload> {
  const state = await getGameState(gameId);

  if (!state) {
    throw new GameError('Game not found', 'GAME_NOT_FOUND');
  }

  const isWhite = state.whitePlayerId === userId;
  const winnerId = isWhite ? state.blackPlayerId : state.whitePlayerId;
  const result: GameResult = isWhite ? 'BLACK_WINS' : 'WHITE_WINS';

  return endGame(state, result, winnerId);
}

/**
 * Handle a player's clock running out.
 */
export async function handleTimeout(
  gameId: string,
  timedOutColor: PieceColor
): Promise<GameOverPayload | null> {
  const state = await getGameState(gameId);
  if (!state || state.status !== 'ACTIVE') return null;

  const winnerId = timedOutColor === 'w' ? state.blackPlayerId : state.whitePlayerId;
  const result: GameResult = 'TIMEOUT';

  return endGame(state, result, winnerId);
}

/**
 * End a game and persist to PostgreSQL.
 */
async function endGame(
  state: GameState,
  result: GameResult,
  winnerId: string | null
): Promise<GameOverPayload> {
  state.status = 'COMPLETED' as GameStatus;
  state.result = result;

  // Persist to PostgreSQL
  try {
    const { updateRatings } = await import('./eloService.js');
    
    await prisma.game.create({
      data: {
        id: state.gameId,
        whitePlayerId: state.whitePlayerId,
        blackPlayerId: state.blackPlayerId,
        winnerId,
        status: 'COMPLETED',
        result: result,
        pgn: state.pgn,
        finalFen: state.fen,
        timeControl: Math.floor(state.timeControl / 1000),
        increment: Math.floor(state.increment / 1000),
        totalMoves: state.moveCount,
        endedAt: new Date(),
      },
    });

    // Update player stats
    await updatePlayerStats(state.whitePlayerId, state.blackPlayerId, result);
    
    // Update Elo ratings
    const { whiteEloChange, blackEloChange } = await updateRatings(
      state.whitePlayerId,
      state.blackPlayerId,
      result,
      winnerId
    );
    
    // Clean up Redis
    await redis.del(`${REDIS_KEYS.GAME}${state.gameId}`);
    await redis.del(`${REDIS_KEYS.USER_ACTIVE_GAME}${state.whitePlayerId}`);
    await redis.del(`${REDIS_KEYS.USER_ACTIVE_GAME}${state.blackPlayerId}`);

    logger.info('Game', `🏁 Game ${state.gameId} ended: ${result}`);

    // Return payload
    return {
      gameId: state.gameId,
      result,
      winnerId,
      newElo: 0,      // Client handles individual elo changes via user fetch or we could send specific ones, but we return generic payload
      eloChange: whiteEloChange, // We'll return white's change as a simplified view, but really client should fetch /me
      pgn: state.pgn,
    };
  } catch (err) {
    logger.error('Game', 'Failed to persist game to database', err);
    
    // Fallback payload if DB fails
    return {
      gameId: state.gameId,
      result,
      winnerId,
      newElo: 0,
      eloChange: 0,
      pgn: state.pgn,
    };
  }
}

/**
 * Update win/loss/draw counters for both players.
 */
async function updatePlayerStats(
  whiteId: string,
  blackId: string,
  result: GameResult
): Promise<void> {
  const whiteUpdate: Record<string, number> = { gamesPlayed: 1 };
  const blackUpdate: Record<string, number> = { gamesPlayed: 1 };

  if (result === 'WHITE_WINS' || (result === 'TIMEOUT' || result === 'RESIGNATION' || result === 'ABANDONMENT')) {
    // For timeout/resignation/abandonment, the winnerId determines who won
    // but for simplicity here, WHITE_WINS/BLACK_WINS is already resolved
    if (result === 'WHITE_WINS') {
      whiteUpdate.wins = 1;
      blackUpdate.losses = 1;
    }
  }
  if (result === 'BLACK_WINS') {
    whiteUpdate.losses = 1;
    blackUpdate.wins = 1;
  }
  if (result === 'DRAW') {
    whiteUpdate.draws = 1;
    blackUpdate.draws = 1;
  }

  await Promise.all([
    prisma.user.update({
      where: { id: whiteId },
      data: {
        gamesPlayed: { increment: whiteUpdate.gamesPlayed ?? 0 },
        wins: { increment: whiteUpdate.wins ?? 0 },
        losses: { increment: whiteUpdate.losses ?? 0 },
        draws: { increment: whiteUpdate.draws ?? 0 },
      },
    }),
    prisma.user.update({
      where: { id: blackId },
      data: {
        gamesPlayed: { increment: blackUpdate.gamesPlayed ?? 0 },
        wins: { increment: blackUpdate.wins ?? 0 },
        losses: { increment: blackUpdate.losses ?? 0 },
        draws: { increment: blackUpdate.draws ?? 0 },
      },
    }),
  ]);
}

/**
 * Get the current game state from Redis.
 */
export async function getGameState(gameId: string): Promise<GameState | null> {
  const data = await redis.get(`${REDIS_KEYS.GAME}${gameId}`);
  if (!data) return null;
  return JSON.parse(data) as GameState;
}

/**
 * Get the active game for a user (for reconnection).
 */
export async function getActiveGameForUser(userId: string): Promise<GameState | null> {
  const gameId = await redis.get(`${REDIS_KEYS.USER_ACTIVE_GAME}${userId}`);
  if (!gameId) return null;
  return getGameState(gameId);
}

/**
 * Check if any player's time has expired in an active game.
 * Called periodically by the clock checker.
 */
export async function checkTimeouts(gameId: string): Promise<PieceColor | null> {
  const state = await getGameState(gameId);
  if (!state || state.status !== 'ACTIVE') return null;

  const now = Date.now();
  const elapsed = now - state.lastMoveAt;

  if (state.turn === 'w') {
    if (state.whiteTimeMs - elapsed <= 0) return 'w';
  } else {
    if (state.blackTimeMs - elapsed <= 0) return 'b';
  }

  return null;
}

/**
 * Generate a unique game ID.
 * Uses a combination of timestamp and random chars.
 */
function generateGameId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `game_${timestamp}_${random}`;
}
