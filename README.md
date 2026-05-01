# ♟ Chess Arena

**Chess Arena** is a premium, real-time multiplayer chess platform built with a minimalist, Apple-inspired design aesthetic. It features an authoritative server architecture, ELO-based matchmaking, real-time gameplay via WebSockets, and a robust anonymous guest login system.

## 🚀 Features

- **Real-Time Multiplayer:** Instant move validation and syncing using WebSockets.
- **Apple-Inspired Aesthetic:** A beautiful, distraction-free monochrome "Bento Box" UI with smooth Framer Motion interactions and frosted glassmorphism.
- **Guest Mode:** Frictionless anonymous login system allowing users to instantly join the matchmaking pool without registering.
- **Authoritative Server:** Game logic runs on the backend to prevent cheating.
- **Monorepo Architecture:** Built using Turborepo to seamlessly share types and logic between the client and server.

## 🛠 Tech Stack

- **Client:** React (Vite), Tailwind CSS v4, Zustand, Framer Motion, Socket.io-client.
- **Server:** Node.js, Express, Socket.io, Prisma, PostgreSQL, Redis (for matchmaking queues).
- **Infrastructure:** Fully containerized using Docker Compose.

## 🏗 Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) & Docker Compose
- Node.js (v18+)
- npm

### Running Locally (Docker)

The easiest way to run the entire stack is using Docker Compose:

```bash
docker compose up --build -d
```
This will start:
- The React Client on `http://localhost`
- The Node.js Server on `http://localhost:3001`
- PostgreSQL Database
- Redis Cache

### Local Development

If you want to run the client in development mode with Hot Module Replacement (HMR):

1. Start the backend infrastructure using Docker:
   ```bash
   docker compose up server postgres redis -d
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the Vite development server:
   ```bash
   npm run dev --workspace=apps/client
   ```
4. Open `http://localhost:5174` in your browser.

## 📦 Project Structure

This project is a monorepo powered by **Turborepo** (`turbo`), which orchestrates tasks across multiple packages:

- `apps/client`: The React frontend application.
- `apps/server`: The Node.js/Express backend and WebSocket server.
- `packages/shared`: Shared TypeScript interfaces, types, and game constants.
- `packages/eslint-config` & `packages/typescript-config`: Shared linting and compilation configurations.

> **Note:** You might have seen "Turborepo" mentioned previously. It is simply the build tool we use behind the scenes to manage the multiple applications (client and server) in this single repository efficiently.
