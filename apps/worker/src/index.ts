import { Worker, Job } from 'bullmq';
import { Redis } from 'ioredis';
import { Chess } from 'chess.js';
import { engineService } from './engineService.js';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

console.log('🚀 [Worker] Analysis worker started and waiting for jobs...');

const worker = new Worker(
  'analysis-queue',
  async (job: Job) => {
    const { gameId, pgn } = job.data;
    console.log(`[Worker] Analyzing game: ${gameId}`);

    const chess = new Chess();
    chess.loadPgn(pgn);
    const history = chess.history({ verbose: true });
    
    const results = [];
    const analysisChess = new Chess();
    
    for (let i = 0; i <= history.length; i++) {
      const fen = analysisChess.fen();
      const evalResult = await engineService.evaluatePosition(fen, 14); // Slightly deeper analysis on worker
      
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

    // After analysis, we could call a callback URL or update the DB directly
    // In a production app, the worker might have its own Prisma client or hit an internal API
    console.log(`[Worker] ✅ Analysis complete for ${gameId}. Results: ${results.length} positions.`);
    
    return { results };
  },
  { connection }
);

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed:`, err);
});
