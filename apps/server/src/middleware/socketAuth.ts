import type { Socket } from 'socket.io';
import { verifyToken } from '../services/authService.js';
import { redis } from '../config/redis.js';
import { REDIS_KEYS } from '@chess-arena/shared';
import { logger } from '../utils/logger.js';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@chess-arena/shared';

// ─────────────────────────────────────────────────────────
// Socket.io Authentication Middleware
// ─────────────────────────────────────────────────────────
// Runs during the WebSocket handshake BEFORE the connection
// is established. This means unauthenticated clients never
// get a socket connection — they're rejected at the door.
//
// The JWT is passed via the `auth.token` field in the
// Socket.io client handshake options.

type AuthSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

/**
 * Socket.io middleware that verifies JWT during the handshake.
 *
 * On success:
 *   - Attaches userId and username to socket.data
 *   - Maps socket.id → userId in Redis (for reconnection logic)
 *   - Calls next() to allow the connection
 *
 * On failure:
 *   - Calls next(Error) which rejects the connection
 *   - Client receives a 'connect_error' event
 */
export function socketAuthMiddleware(
  socket: AuthSocket,
  next: (err?: Error) => void
): void {
  try {
    const token = socket.handshake.auth?.token as string | undefined;

    if (!token) {
      logger.warn('SocketAuth', `Connection rejected: no token (${socket.id})`);
      return next(new Error('Authentication required'));
    }

    const payload = verifyToken(token);

    // Attach user data to the socket for use in event handlers
    socket.data.userId = payload.userId;
    socket.data.username = payload.username;

    // Map this user's socket ID in Redis for reconnection support.
    // When a user disconnects and reconnects, we can find their
    // previous active game by looking up their userId.
    redis
      .set(
        `${REDIS_KEYS.USER_SOCKET}${payload.userId}`,
        socket.id,
        'EX',
        3600 // expires in 1 hour
      )
      .catch((err) => {
        logger.error('SocketAuth', 'Failed to store socket mapping', err);
      });

    logger.info(
      'SocketAuth',
      `✅ Authenticated: ${payload.username} (${payload.userId}) → socket ${socket.id}`
    );

    next();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed';
    logger.warn('SocketAuth', `Connection rejected: ${message} (${socket.id})`);
    next(new Error(message));
  }
}
