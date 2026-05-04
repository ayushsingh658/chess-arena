import { Chess } from 'chess.js';
import { engineService } from './engineService.js';
import { prisma } from '../config/database.js';
import { logger } from '../utils/logger.js';

export async function performAutoAnalysis(gameId: string) {
  try {
    logger.info('Analysis', `Starting auto-analysis for game ${gameId}`);
    
    const game = await prisma.game.findUnique({ where: { id: gameId } });
    if (!game) return;

    const chess = new Chess();
    chess.loadPgn(game.pgn);
    const history = chess.history({ verbose: true });
    
    const results = [];
    const analysisChess = new Chess();
    
    // Process move by move
    for (let i = 0; i <= history.length; i++) {
      const fen = analysisChess.fen();
      const evalResult = await engineService.evaluatePosition(fen, 12);
      
      results.push({
        moveIndex: i,
        fen,
        score: evalResult.score,
        bestMove: evalResult.bestMove,
        movePlayed: i < history.length ? history[i]?.san || null : null,
      });
      
      if (i < history.length) {
        const move = history[i];
        if (move) analysisChess.move(move);
      }
    }

    const whiteAccuracy = calculateAccuracy(results, 'w');
    const blackAccuracy = calculateAccuracy(results, 'b');

    // Flagging logic
    let isFlagged = false;
    let flagReason = null;

    if (whiteAccuracy > 98 && history.length > 10) {
      isFlagged = true;
      flagReason = 'White accuracy extremely high (>98%)';
    } else if (blackAccuracy > 98 && history.length > 10) {
      isFlagged = true;
      flagReason = 'Black accuracy extremely high (>98%)';
    }

    // @ts-ignore - analysisJson might not be in generated types yet if prisma push/generate was slow
    await prisma.game.update({
      where: { id: gameId },
      data: {
        analysisJson: JSON.stringify(results),
        whiteAccuracy,
        blackAccuracy,
        isFlagged,
        flagReason,
      } as any
    });

    logger.info('Analysis', `Completed analysis for ${gameId}. White: ${whiteAccuracy}%, Black: ${blackAccuracy}% ${isFlagged ? '[FLAGGED]' : ''}`);
  } catch (err) {
    logger.error('Analysis', `Failed auto-analysis for ${gameId}`, err);
  }
}

function calculateAccuracy(results: any[], side: 'w' | 'b'): number {
  let totalLoss = 0;
  let moves = 0;
  
  for (let i = 1; i < results.length; i++) {
    const isWhiteMove = i % 2 !== 0;
    if ((side === 'w' && isWhiteMove) || (side === 'b' && !isWhiteMove)) {
      const prev = results[i-1];
      const curr = results[i];
      if (prev && curr) {
        const loss = side === 'w' ? (prev.score - curr.score) : (curr.score - prev.score);
        totalLoss += Math.max(0, loss);
        moves++;
      }
    }
  }
  
  if (moves === 0) return 100;
  const avgLoss = totalLoss / moves;
  return Math.max(0, Math.min(100, 100 - (avgLoss / 8)));
}
