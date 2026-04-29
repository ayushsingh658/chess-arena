import { prisma } from '../config/database.js';
import { GameResult } from '@chess-arena/shared';
import { logger } from '../utils/logger.js';

// ─────────────────────────────────────────────────────────
// Glicko-2 Rating System
// ─────────────────────────────────────────────────────────
// Calculates rating, rating deviation, and volatility.
// Based on Mark Glickman's paper: http://www.glicko.net/glicko/glicko2.pdf

const TAU = 0.5; // System constant determining volatility change over time
const SCALE = 173.7178; // Glicko-2 scale factor
const EPSILON = 0.000001;

interface GlickoPlayer {
  id: string;
  rating: number;     // Original rating (e.g. 1200)
  rd: number;         // Original RD (e.g. 350)
  vol: number;        // Original volatility (e.g. 0.06)
  mu?: number;        // Scaled rating
  phi?: number;       // Scaled RD
}

/**
 * Calculates and updates the Glicko-2 ratings for both players.
 * Returns the Elo change for each player.
 */
export async function updateRatings(
  whiteId: string,
  blackId: string,
  result: GameResult,
  winnerId: string | null
): Promise<{ whiteEloChange: number; blackEloChange: number }> {
  const [whiteUser, blackUser] = await Promise.all([
    prisma.user.findUnique({ where: { id: whiteId } }),
    prisma.user.findUnique({ where: { id: blackId } })
  ]);

  if (!whiteUser || !blackUser) {
    logger.warn('Elo', `Missing user(s) for rating update: ${whiteId}, ${blackId}`);
    return { whiteEloChange: 0, blackEloChange: 0 };
  }

  const whitePlayer: GlickoPlayer = {
    id: whiteUser.id,
    rating: whiteUser.eloRating,
    rd: whiteUser.ratingDeviation,
    vol: whiteUser.volatility,
  };

  const blackPlayer: GlickoPlayer = {
    id: blackUser.id,
    rating: blackUser.eloRating,
    rd: blackUser.ratingDeviation,
    vol: blackUser.volatility,
  };

  // Convert game result to scores (1 = win, 0.5 = draw, 0 = loss)
  let whiteScore = 0.5;
  let blackScore = 0.5;

  if (result === 'DRAW') {
    whiteScore = 0.5;
    blackScore = 0.5;
  } else if (winnerId === whiteId) {
    whiteScore = 1;
    blackScore = 0;
  } else if (winnerId === blackId) {
    whiteScore = 0;
    blackScore = 1;
  }

  // Calculate new ratings
  const newWhite = calculateNewRating(whitePlayer, blackPlayer, whiteScore);
  const newBlack = calculateNewRating(blackPlayer, whitePlayer, blackScore);

  const whiteEloChange = Math.round(newWhite.rating) - Math.round(whitePlayer.rating);
  const blackEloChange = Math.round(newBlack.rating) - Math.round(blackPlayer.rating);

  // Update in DB
  await Promise.all([
    prisma.user.update({
      where: { id: whiteId },
      data: {
        eloRating: Math.round(newWhite.rating),
        ratingDeviation: newWhite.rd,
        volatility: newWhite.vol
      }
    }),
    prisma.user.update({
      where: { id: blackId },
      data: {
        eloRating: Math.round(newBlack.rating),
        ratingDeviation: newBlack.rd,
        volatility: newBlack.vol
      }
    })
  ]);

  logger.info('Elo', `Ratings updated: White(${whiteEloChange}) Black(${blackEloChange})`);

  return { whiteEloChange, blackEloChange };
}

/**
 * Step 2: Convert to Glicko-2 scale
 */
function toGlickoScale(p: GlickoPlayer): GlickoPlayer {
  return {
    ...p,
    mu: (p.rating - 1500) / SCALE,
    phi: p.rd / SCALE,
  };
}

/**
 * Step 8: Convert back to original scale
 */
function fromGlickoScale(mu: number, phi: number, vol: number): GlickoPlayer {
  return {
    id: '',
    rating: mu * SCALE + 1500,
    rd: phi * SCALE,
    vol
  };
}

/**
 * The g(phi) function
 */
function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

/**
 * The E(mu, mu_j, phi_j) function
 */
function E(mu: number, mu_j: number, phi_j: number): number {
  return 1 / (1 + Math.exp(-g(phi_j) * (mu - mu_j)));
}

/**
 * Core Glicko-2 algorithm for a single match
 */
function calculateNewRating(player: GlickoPlayer, opponent: GlickoPlayer, score: number): GlickoPlayer {
  const p = toGlickoScale(player);
  const opp = toGlickoScale(opponent);

  const mu = p.mu!;
  const phi = p.phi!;
  const vol = p.vol;

  const mu_j = opp.mu!;
  const phi_j = opp.phi!;

  // Step 3: Estimated variance (v)
  const g_j = g(phi_j);
  const E_j = E(mu, mu_j, phi_j);
  const v = 1 / (g_j * g_j * E_j * (1 - E_j));

  // Step 4: Estimated improvement (Delta)
  const delta = v * g_j * (score - E_j);

  // Step 5: New volatility
  const a = Math.log(vol * vol);
  const f = (x: number) => {
    const e_x = Math.exp(x);
    const num = e_x * (delta * delta - phi * phi - v - e_x);
    const den = 2 * Math.pow(phi * phi + v + e_x, 2);
    return num / den - (x - a) / (TAU * TAU);
  };

  let A = a;
  let B = 0;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) {
      k++;
    }
    B = a - k * TAU;
  }

  let f_A = f(A);
  let f_B = f(B);

  while (Math.abs(B - A) > EPSILON) {
    const C = A + ((A - B) * f_A) / (f_B - f_A);
    const f_C = f(C);
    if (f_C * f_B <= 0) {
      A = B;
      f_A = f_B;
    } else {
      f_A = f_A / 2;
    }
    B = C;
    f_B = f_C;
  }

  const newVol = Math.exp(A / 2);

  // Step 6: Update rating deviation to pre-rating period value
  const phiStar = Math.sqrt(phi * phi + newVol * newVol);

  // Step 7: Update rating and RD
  const newPhi = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  const newMu = mu + newPhi * newPhi * g_j * (score - E_j);

  return fromGlickoScale(newMu, newPhi, newVol);
}
