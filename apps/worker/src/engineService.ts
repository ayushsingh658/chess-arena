import { spawn, ChildProcess } from 'node:child_process';

export interface EngineEvaluation {
  score: number;
  bestMove: string;
  depth: number;
}

class EngineService {
  private stockfish: ChildProcess | null = null;
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
          if (this.responseQueue.length > 0) {
            const resolver = this.responseQueue[0];
            if (resolver) resolver(line);
          }
        }
      });
    } catch (err) {
      console.error('[Worker Engine] Failed to start Stockfish:', err);
    }
  }

  private sendUCI(command: string) {
    if (this.stockfish?.stdin) {
      this.stockfish.stdin.write(`${command}\n`);
    }
  }

  async evaluatePosition(fen: string, depth: number = 12): Promise<EngineEvaluation> {
    return new Promise((resolve) => {
      this.sendUCI(`position fen ${fen}`);
      this.sendUCI(`go depth ${depth}`);

      let lastScore = 0;

      const listener = (line: string) => {
        if (line.includes('score cp')) {
          const parts = line.split(' ');
          const scoreIdx = parts.indexOf('cp');
          if (scoreIdx !== -1 && parts[scoreIdx + 1]) {
            lastScore = parseInt(parts[scoreIdx + 1]!, 10);
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
}

export const engineService = new EngineService();
