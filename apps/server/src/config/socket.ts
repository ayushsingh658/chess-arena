import { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createRedisClient } from './redis.js';
import { env } from './env.js';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData,
} from '@chess-arena/shared';

// ─────────────────────────────────────────────────────────
// Socket.io Server Factory
// ─────────────────────────────────────────────────────────
// The Redis adapter is critical for horizontal scaling.
// Without it, if Player A connects to Server 1 and Player B
// to Server 2, room broadcasts would fail silently.
// The adapter uses Redis Pub/Sub to relay events across
// all Node.js instances.

export type TypedIO = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  InterServerEvents,
  SocketData
>;

export function createSocketServer(httpServer: HttpServer): TypedIO {
  const io: TypedIO = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    // Ping every 10s, timeout after 20s of no response
    pingInterval: 10_000,
    pingTimeout: 20_000,
    // Allow WebSocket and long-polling (fallback)
    transports: ['websocket', 'polling'],
  });

  // Attach Redis adapter for multi-server scaling
  const pubClient = createRedisClient('socket-pub');
  const subClient = createRedisClient('socket-sub');

  io.adapter(createAdapter(pubClient, subClient));

  console.log('[Socket.io] ✅ Server initialized with Redis adapter');

  return io;
}
