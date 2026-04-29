# ─────────────────────────────────────────────────────────
# Client Dockerfile (Turborepo + Vite + Nginx)
# ─────────────────────────────────────────────────────────

# Stage 1: Prune monorepo
FROM node:22-alpine AS pruner
WORKDIR /app
RUN apk update && apk add --no-cache libc6-compat
RUN npm install -g turbo
COPY . .
RUN turbo prune --scope=@chess-arena/client --docker

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

# Build packages/shared first, then client
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/client

# Stage 3: Nginx Web Server
FROM nginx:alpine AS runner
# Copy custom Nginx configuration for the client (SPA routing)
# We will just write a small nginx conf directly or use default with try_files
RUN rm -rf /usr/share/nginx/html/*
COPY --from=builder /app/apps/client/dist /usr/share/nginx/html

COPY apps/client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
