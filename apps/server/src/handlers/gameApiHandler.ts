import { Router } from 'express';
import * as gameService from '../services/gameService.js';
import { logger } from '../utils/logger.js';
import { prisma } from '../config/database.js';
import { Chess } from 'chess.js';

export const gameRouter = Router();

/**
 * GET /games/live
 * Returns a list of all currently active games for spectators.
 */
gameRouter.get('/live', async (_req, res) => {
  try {
    const liveGames = await gameService.getLiveGames();
    res.json({ games: liveGames });
  } catch (err) {
    logger.error('API', 'Failed to fetch live games', err);
    res.status(500).json({ message: 'Internal server error' });
  }
});

/**
 * POST /games/:id/analyze
 * Triggers a full engine analysis for a completed game.
 */
gameRouter.post('/:id/analyze', async (req, res) => {
  try {
    const { id } = req.params;
    const { engineService } = await import('../services/engineService.js');
    
    // 1. Fetch game from DB
    const game = await prisma.game.findUnique({ where: { id } });
    if (!game) return res.status(404).json({ message: 'Game not found' });
    
    // 2. Initialize analysis
    const chess = new Chess();
    chess.loadPgn(game.pgn);
    const history = chess.history({ verbose: true });
    
    const analysisResults = [];
    const analysisChess = new Chess();
    
    // We analyze move by move
    for (let i = 0; i <= history.length; i++) {
      const fen = analysisChess.fen();
      const evalResult = await engineService.evaluatePosition(fen, 10); // Lower depth for speed
      
      analysisResults.push({
        moveIndex: i,
        fen,
        score: evalResult.score,
        bestMove: evalResult.bestMove,
        movePlayed: i < history.length ? history[i].san : null,
      });
      
      if (i < history.length) {
        analysisChess.move(history[i]);
      }
    }

    // 3. Calculate Accuracy & Move Qualities (Simplified)
    // Real chess sites use complex formulas for accuracy.
    // Here we'll just return the move-by-move scores.
    
    res.json({
      gameId: id,
      analysis: analysisResults,
      accuracy: {
        white: calculateAccuracy(analysisResults, 'w'),
        black: calculateAccuracy(analysisResults, 'b'),
      }
    });
  } catch (err) {
    logger.error('API', 'Analysis failed', err);
    res.status(500).json({ message: 'Analysis failed' });
  }
});

function calculateAccuracy(results: any[], side: 'w' | 'b'): number {
  // Very simplified accuracy formula based on average centipawn loss
  let totalLoss = 0;
  let moves = 0;
  
  for (let i = 1; i < results.length; i++) {
    const prev = results[i-1];
    const curr = results[i];
    
    // If it's the target side's move
    const isWhiteMove = i % 2 !== 0;
    if ((side === 'w' && isWhiteMove) || (side === 'b' && !isWhiteMove)) {
      const loss = side === 'w' ? (prev.score - curr.score) : (curr.score - prev.score);
      totalLoss += Math.max(0, loss);
      moves++;
    }
  }
  
  if (moves === 0) return 100;
  const avgLoss = totalLoss / moves;
  return Math.max(0, Math.min(100, 100 - (avgLoss / 10)));
}
