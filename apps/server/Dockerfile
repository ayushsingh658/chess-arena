# ─────────────────────────────────────────────────────────
# Server Dockerfile (Turborepo)
# ─────────────────────────────────────────────────────────

# Stage 1: Prune monorepo
FROM node:22-alpine AS pruner
WORKDIR /app
RUN apk update && apk add --no-cache libc6-compat
RUN npm install -g turbo
COPY . .
RUN turbo prune --scope=@chess-arena/server --docker

# Stage 2: Install and build
FROM node:22-alpine AS builder
WORKDIR /app
RUN apk update && apk add --no-cache libc6-compat
# Install dependencies based on the pruned lockfile
COPY --from=pruner /app/out/json/ .
COPY --from=pruner /app/out/package-lock.json ./package-lock.json
RUN npm ci

# Copy the rest of the pruned source
COPY --from=pruner /app/out/full/ .

# Generate Prisma client and build
RUN npx prisma generate --schema=apps/server/prisma/schema.prisma
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/server

# Stage 3: Production runner
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Don't run production as root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 expressjs
USER expressjs

# Copy package.json files for dependencies
COPY --from=builder /app/package.json .
COPY --from=builder /app/package-lock.json .
COPY --from=builder /app/apps/server/package.json ./apps/server/
COPY --from=builder /app/packages/shared/package.json ./packages/shared/

# Install only production dependencies
# Wait, for a monorepo it's often easier to just copy node_modules from builder
# Let's copy everything from builder and rely on NODE_ENV=production
COPY --from=builder --chown=expressjs:nodejs /app/node_module[s] ./node_modules
COPY --from=builder --chown=expressjs:nodejs /app/apps/server/node_module[s] ./apps/server/node_modules
COPY --from=builder --chown=expressjs:nodejs /app/packages/shared/node_module[s] ./packages/shared/node_modules

# Copy Prisma schema and generated client
COPY --from=builder --chown=expressjs:nodejs /app/apps/server/prisma ./apps/server/prisma

# Copy built code
COPY --from=builder --chown=expressjs:nodejs /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder --chown=expressjs:nodejs /app/apps/server/dist ./apps/server/dist

WORKDIR /app/apps/server
EXPOSE 3001

CMD ["node", "dist/index.js"]
