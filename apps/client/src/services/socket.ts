import { io, Socket } from 'socket.io-client';
import { getAccessToken } from './api';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from '@chess-arena/shared';

// ─────────────────────────────────────────────────────────
// Socket.io Client (Singleton)
// ─────────────────────────────────────────────────────────
// Manages a single WebSocket connection to the server.
// The connection is lazy — it only connects when explicitly
// called, after the user has authenticated.
//
// The JWT is passed in the handshake auth object, which the
// server's socketAuth middleware validates before allowing
// the connection.

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: TypedSocket | null = null;

/**
 * Get or create the Socket.io client connection.
 * Passes the current JWT in the handshake for authentication.
 */
export function connectSocket(): TypedSocket {
  if (socket?.connected) {
    return socket;
  }

  const token = getAccessToken();
  if (!token) {
    throw new Error('Cannot connect socket: no access token');
  }

  socket = io({
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  }) as TypedSocket;

  socket.on('connect', () => {
    console.log('[Socket] ✅ Connected:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] 🔴 Disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('[Socket] ❌ Connection error:', error.message);
  });

  return socket;
}

/**
 * Disconnect and clean up the socket connection.
 */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Get the current socket instance (or null if not connected).
 */
export function getSocket(): TypedSocket | null {
  return socket;
}
