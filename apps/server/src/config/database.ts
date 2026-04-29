import { PrismaClient } from '@prisma/client';
import { env } from './env.js';

// ─────────────────────────────────────────────────────────
// Database Client (Singleton)
// ─────────────────────────────────────────────────────────
// In development, hot-reloading can create multiple Prisma
// instances, exhausting the connection pool. We store the
// client on `globalThis` to prevent this.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
