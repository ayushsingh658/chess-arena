export interface CapturedPieces {
  p: number;
  n: number;
  b: number;
  r: number;
  q: number;
}

export interface MaterialAdvantage {
  white: number;
  black: number;
  whiteCaptured: CapturedPieces; // pieces black has captured from white
  blackCaptured: CapturedPieces; // pieces white has captured from black
}

const STARTING_COUNTS: Record<string, number> = {
  p: 8, n: 2, b: 2, r: 2, q: 1, k: 1,
  P: 8, N: 2, B: 2, R: 2, Q: 1, K: 1,
};

const PIECE_VALUES: Record<string, number> = {
  p: 1, n: 3, b: 3, r: 5, q: 9, k: 0,
};

/**
 * Parses a FEN string to determine captured pieces and material advantage.
 */
export function getMaterialAdvantage(fen: string): MaterialAdvantage {
  const boardPart = fen.split(' ')[0] || '';
  const currentCounts: Record<string, number> = {};

  for (const char of boardPart) {
    if (/[a-zA-Z]/.test(char)) {
      currentCounts[char] = (currentCounts[char] || 0) + 1;
    }
  }

  const whiteCaptured: CapturedPieces = { p: 0, n: 0, b: 0, r: 0, q: 0 };
  const blackCaptured: CapturedPieces = { p: 0, n: 0, b: 0, r: 0, q: 0 };

  let whiteScore = 0;
  let blackScore = 0;

  // Calculate what Black has captured from White (lowercase in our interface, but means White's pieces P,N,B,R,Q)
  for (const piece of ['P', 'N', 'B', 'R', 'Q']) {
    const startCount = STARTING_COUNTS[piece]!;
    const currentCount = currentCounts[piece] || 0;
    const capturedCount = Math.max(0, startCount - currentCount);
    
    const pieceKey = piece.toLowerCase() as keyof CapturedPieces;
    whiteCaptured[pieceKey] = capturedCount;
    blackScore += capturedCount * PIECE_VALUES[pieceKey]!;
  }

  // Calculate what White has captured from Black (lowercase pieces p,n,b,r,q)
  for (const piece of ['p', 'n', 'b', 'r', 'q']) {
    const startCount = STARTING_COUNTS[piece]!;
    const currentCount = currentCounts[piece] || 0;
    const capturedCount = Math.max(0, startCount - currentCount);
    
    const pieceKey = piece.toLowerCase() as keyof CapturedPieces;
    blackCaptured[pieceKey] = capturedCount;
    whiteScore += capturedCount * PIECE_VALUES[pieceKey]!;
  }

  return {
    white: Math.max(0, whiteScore - blackScore),
    black: Math.max(0, blackScore - whiteScore),
    whiteCaptured, // pieces missing from white
    blackCaptured, // pieces missing from black
  };
}
