import { ClientEvents, ServerEvents, DISCONNECT_TIMEOUT_MS } from '@chess-arena/shared';
import * as matchmakingService from '../services/matchmakingService.js';
import * as gameService from '../services/gameService.js';
import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';
import type { TypedIO } from '../config/socket.js';
import type { Socket } from 'socket.io';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
  Move,
} from '@chess-arena/shared';

type TypedSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

// Track disconnect timeouts so they can be cancelled on reconnect
const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

// ─────────────────────────────────────────────────────────
// Socket Event Handlers
// ─────────────────────────────────────────────────────────
// Registers all game-related socket event listeners.
// Each handler follows the authoritative server pattern:
//   Client requests → Server validates → Server broadcasts

export function registerGameHandlers(io: TypedIO, socket: TypedSocket): void {
  const { userId, username } = socket.data;

  // ── Matchmaking ────────────────────────────────────────

  socket.on(ClientEvents.FIND_MATCH, async (payload) => {
    try {
      // Get user's current Elo
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { eloRating: true },
      });

      if (!user) {
        socket.emit(ServerEvents.ERROR, {
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        });
        return;
      }

      await matchmakingService.joinQueue(
        userId,
        username,
        socket.id,
        user.eloRating,
        payload.timeControl
      );

      logger.info('Handler', `${username} searching for match (${payload.timeControl.name})`);
    } catch (err) {
      logger.error('Handler', 'Find match error', err);
      socket.emit(ServerEvents.ERROR, {
        message: 'Failed to join matchmaking queue',
        code: 'MATCHMAKING_ERROR',
      });
    }
  });

  socket.on(ClientEvents.CANCEL_MATCH, async () => {
    try {
      await matchmakingService.removeFromAllQueues(userId);
      logger.info('Handler', `${username} cancelled matchmaking`);
    } catch (err) {
      logger.error('Handler', 'Cancel match error', err);
    }
  });

  // ── Game Moves ─────────────────────────────────────────

  socket.on(ClientEvents.MOVE_REQUEST, async (payload) => {
    try {
      const { gameUpdate, gameOver } = await gameService.makeMove(
        payload.gameId,
        userId,
        payload.move
      );

      // Broadcast updated state to all players in the game room
      io.to(`game:${payload.gameId}`).emit(ServerEvents.GAME_UPDATE, gameUpdate);

      // If game is over, emit game over event
      if (gameOver) {
        io.to(`game:${payload.gameId}`).emit(ServerEvents.GAME_OVER, gameOver);

        // Clean up: remove all sockets from the game room
        const sockets = await io.in(`game:${payload.gameId}`).fetchSockets();
        for (const s of sockets) {
          s.leave(`game:${payload.gameId}`);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Move failed';
      socket.emit(ServerEvents.MOVE_REJECTED, { reason: message });
    }
  });

  // ── Resign ─────────────────────────────────────────────

  socket.on(ClientEvents.RESIGN, async (payload) => {
    try {
      const gameOver = await gameService.resign(payload.gameId, userId);

      io.to(`game:${payload.gameId}`).emit(ServerEvents.GAME_OVER, gameOver);

      const sockets = await io.in(`game:${payload.gameId}`).fetchSockets();
      for (const s of sockets) {
        s.leave(`game:${payload.gameId}`);
      }

      logger.info('Handler', `${username} resigned in game ${payload.gameId}`);
    } catch (err) {
      logger.error('Handler', 'Resign error', err);
    }
  });

  // ── Draw Offer ─────────────────────────────────────────

  socket.on(ClientEvents.OFFER_DRAW, async (payload) => {
    // Relay draw offer to opponent via the game room
    socket.to(`game:${payload.gameId}`).emit(ServerEvents.GAME_UPDATE, {
      gameId: payload.gameId,
      fen: '',
      turn: 'w',
      lastMove: null,
      whiteTimeMs: 0,
      blackTimeMs: 0,
      status: 'ACTIVE',
      pgn: '',
      moveCount: 0,
      // The client will detect this as a draw offer via a separate mechanism
    } as any); // eslint-disable-line @typescript-eslint/no-explicit-any
    // TODO: Implement dedicated DRAW_OFFERED event in Phase 5+
  });

  socket.on(ClientEvents.RESPOND_DRAW, async (payload) => {
    if (payload.accept) {
      try {
        const state = await gameService.getGameState(payload.gameId);
        if (state) {
          // End game as draw
          const gameOver = await gameService.resign(payload.gameId, ''); // Will need a dedicated draw method
          io.to(`game:${payload.gameId}`).emit(ServerEvents.GAME_OVER, {
            ...gameOver,
            result: 'DRAW' as any,
            winnerId: null,
          });
        }
      } catch (err) {
        logger.error('Handler', 'Draw accept error', err);
      }
    }
  });

  // ── Reconnection ───────────────────────────────────────

  socket.on(ClientEvents.RECONNECT_GAME, async () => {
    try {
      const activeGame = await gameService.getActiveGameForUser(userId);

      if (activeGame) {
        // Rejoin the game room
        socket.join(`game:${activeGame.gameId}`);

        // Send current game state
        socket.emit(ServerEvents.GAME_UPDATE, {
          gameId: activeGame.gameId,
          fen: activeGame.fen,
          turn: activeGame.turn,
          lastMove: null,
          whiteTimeMs: activeGame.whiteTimeMs,
          blackTimeMs: activeGame.blackTimeMs,
          status: activeGame.status,
          pgn: activeGame.pgn,
          moveCount: activeGame.moveCount,
        });

        // Cancel any pending disconnect timer
        const timerKey = `${activeGame.gameId}:${userId}`;
        const timer = disconnectTimers.get(timerKey);
        if (timer) {
          clearTimeout(timer);
          disconnectTimers.delete(timerKey);

          // Notify opponent
          socket.to(`game:${activeGame.gameId}`).emit(ServerEvents.OPPONENT_RECONNECTED);
        }

        logger.info('Handler', `${username} reconnected to game ${activeGame.gameId}`);
      }
    } catch (err) {
      logger.error('Handler', 'Reconnect error', err);
    }
  });

  // ── Disconnect Handling ────────────────────────────────

  socket.on('disconnect', async () => {
    // Remove from matchmaking queue
    await matchmakingService.removeFromAllQueues(userId);

    // Check for active game
    const activeGame = await gameService.getActiveGameForUser(userId);

    if (activeGame && activeGame.status === 'ACTIVE') {
      // Notify opponent
      socket.to(`game:${activeGame.gameId}`).emit(ServerEvents.OPPONENT_DISCONNECTED, {
        timeoutMs: DISCONNECT_TIMEOUT_MS,
      });

      // Start disconnect countdown
      const timerKey = `${activeGame.gameId}:${userId}`;
      const timer = setTimeout(async () => {
        disconnectTimers.delete(timerKey);

        // Player didn't reconnect — they lose by abandonment
        try {
          const isWhite = activeGame.whitePlayerId === userId;
          const winnerId = isWhite ? activeGame.blackPlayerId : activeGame.whitePlayerId;

          const state = await gameService.getGameState(activeGame.gameId);
          if (state && state.status === 'ACTIVE') {
            const gameOver = await gameService.resign(activeGame.gameId, userId);
            io.to(`game:${activeGame.gameId}`).emit(ServerEvents.GAME_OVER, {
              ...gameOver,
              result: 'ABANDONMENT' as any,
            });
          }
        } catch (err) {
          logger.error('Handler', 'Disconnect timeout error', err);
        }
      }, DISCONNECT_TIMEOUT_MS);

      disconnectTimers.set(timerKey, timer);

      logger.info(
        'Handler',
        `${username} disconnected from game ${activeGame.gameId} — ${DISCONNECT_TIMEOUT_MS / 1000}s countdown started`
      );
    }
  });
}
