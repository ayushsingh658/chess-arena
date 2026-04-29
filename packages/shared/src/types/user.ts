// ─────────────────────────────────────────────────────────
// User Types — Persistent data stored in PostgreSQL
// ─────────────────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  email: string;
  eloRating: number;
  ratingDeviation: number;
  volatility: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  createdAt: Date;
}

/**
 * Public-facing profile — never expose email or password data.
 * This is what opponents and spectators see.
 */
export interface PublicProfile {
  id: string;
  username: string;
  eloRating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
}

export interface AuthCredentials {
  email: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  user: PublicProfile;
  accessToken: string;
}
