import express from 'express';
import { createServer } from 'node:http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { createSocketServer } from './config/socket.js';
import { initSentry } from './config/sentry.js';
import { socketAuthMiddleware } from './middleware/socketAuth.js';
import { authRouter } from './handlers/authHandler.js';
import { userRouter } from './handlers/userHandler.js';
import { gameRouter } from './handlers/gameApiHandler.js';
import { registerGameHandlers } from './handlers/gameHandler.js';
import { startMatchmakingWorker } from './workers/matchmakingWorker.js';
import { startClockWorker } from './workers/clockWorker.js';
import { logger } from './utils/logger.js';
import { apiRateLimiter } from './middleware/rateLimit.js';

// ─────────────────────────────────────────────────────────
// Server Entry Point
// ─────────────────────────────────────────────────────────

// Initialize Error Tracking
initSentry();

const app = express();

// ── Middleware ──────────────────────────────────────────
app.use(cors({
  origin: env.CLIENT_URL,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Apply general API rate limiting
app.use(apiRateLimiter);

// ── Health Check ───────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ── REST Routes ────────────────────────────────────────
app.use('/auth', authRouter);
app.use('/users', userRouter);
app.use('/games', gameRouter);

// ── HTTP Server + Socket.io ────────────────────────────
const httpServer = createServer(app);
const io = createSocketServer(httpServer);

// Socket.io authentication middleware
io.use(socketAuthMiddleware);

// Handle authenticated connections
io.on('connection', (socket) => {
  const { userId, username } = socket.data;
  logger.info('Socket', `🟢 ${username} connected (${socket.id})`);

  // Join a personal room for targeted messages
  socket.join(`user:${userId}`);

  // Register all game-related event handlers
  registerGameHandlers(io, socket);

  // Check for active game on connect (reconnection support)
  socket.emit('game:reconnect' as any);
});

// ── Start Matchmaking Worker ───────────────────────────
startMatchmakingWorker(io);

// ── Start Clock Worker ───────────────────────────
startClockWorker(io);

// ── Start Server ───────────────────────────────────────
httpServer.listen(env.PORT, () => {
  logger.info('Server', `🚀 Chess Arena server running on port ${env.PORT}`);
  logger.info('Server', `📡 Environment: ${env.NODE_ENV}`);
  logger.info('Server', `🌐 Client URL: ${env.CLIENT_URL}`);
  logger.info('Server', `🔐 Auth: /auth/register, /auth/login, /auth/me`);
  logger.info('Server', `🎮 Game: WebSocket matchmaking + game loop active`);
});

// ── Graceful Shutdown ──────────────────────────────────
async function gracefulShutdown(signal: string) {
  logger.info('Server', `${signal} received. Shutting down gracefully...`);

  // Stop accepting new socket connections
  io.close();

  httpServer.close(async () => {
    logger.info('Server', 'HTTP server closed');

    try {
      // Close Database Connections
      const { prisma } = await import('./config/database.js');
      await prisma.$disconnect();
      logger.info('Server', 'Prisma disconnected');

      // Close Redis Connections
      const { redis } = await import('./config/redis.js');
      await redis.quit();
      logger.info('Server', 'Redis disconnected');

      process.exit(0);
    } catch (err) {
      logger.error('Server', 'Error during shutdown', err);
      process.exit(1);
    }
  });

  // Force exit after 10 seconds if graceful shutdown hangs
  setTimeout(() => {
    logger.error('Server', 'Forced shutdown after timeout');
    process.exit(1);
  }, 10_000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

export { app, io };
