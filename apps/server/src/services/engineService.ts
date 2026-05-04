import { spawn, ChildProcess } from 'node:child_process';
import { logger } from '../utils/logger.js';

export interface EngineEvaluation {
  score: number; // in centipawns
  bestMove: string;
  depth: number;
}

class EngineService {
  private stockfish: ChildProcess | null = null;
  private isReady: boolean = false;
  private responseQueue: ((data: string) => void)[] = [];

  constructor() {
    this.init();
  }

  private init() {
    try {
      this.stockfish = spawn('stockfish');

      this.stockfish.stdout?.on('data', (data) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          if (line.trim() === 'readyok') {
            this.isReady = true;
          }
          if (this.responseQueue.length > 0) {
            const resolver = this.responseQueue[0];
            if (resolver) resolver(line);
          }
        }
      });

      this.stockfish.on('error', (err) => {
        logger.error('Engine', 'Stockfish error', err);
      });

      this.sendUCI('uci');
      this.sendUCI('isready');
    } catch (err) {
      logger.error('Engine', 'Failed to start Stockfish. Ensure it is installed on the system.', err);
    }
  }

  private sendUCI(command: string) {
    if (this.stockfish?.stdin) {
      this.stockfish.stdin.write(`${command}\n`);
    }
  }

  /**
   * Evaluate a position given by FEN.
   * @param fen FEN string of the position.
   * @param depth Search depth (default 12 for speed/accuracy balance).
   */
  async evaluatePosition(fen: string, depth: number = 12): Promise<EngineEvaluation> {
    return new Promise((resolve) => {
      this.sendUCI(`position fen ${fen}`);
      this.sendUCI(`go depth ${depth}`);

      let lastScore = 0;

      const listener = (line: string) => {
        // Parse info lines for scores
        if (line.includes('score cp')) {
          const parts = line.split(' ');
          const scoreIdx = parts.indexOf('cp');
          if (scoreIdx !== -1 && parts[scoreIdx + 1]) {
            lastScore = parseInt(parts[scoreIdx + 1]!, 10);
          }
        } else if (line.includes('score mate')) {
          // Mate in X
          const parts = line.split(' ');
          const mateIdx = parts.indexOf('mate');
          if (mateIdx !== -1 && parts[mateIdx + 1]) {
            const mateIn = parseInt(parts[mateIdx + 1]!, 10);
            lastScore = mateIn > 0 ? 10000 : -10000; // Simplified mate score
          }
        }

        if (line.startsWith('bestmove')) {
          const parts = line.split(' ');
          const bestMove = parts[1] || '0000';
          this.responseQueue = this.responseQueue.filter(l => l !== listener);
          resolve({ score: lastScore, bestMove, depth });
        }
      };

      this.responseQueue.push(listener);
    });
  }

  /**
   * Shutdown the engine.
   */
  terminate() {
    if (this.stockfish) {
      this.stockfish.kill();
      this.stockfish = null;
    }
  }
}

export const engineService = new EngineService();
