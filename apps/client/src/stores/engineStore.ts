import { create } from 'zustand';

interface EngineState {
  evaluation: number; // Centipawns relative to White (+ is White advantage)
  bestMove: string | null;
  isThinking: boolean;
  enabled: boolean;
  
  toggleEnabled: () => void;
  analyzePosition: (fen: string) => void;
  stopAnalysis: () => void;
}

export const useEngineStore = create<EngineState>((set, get) => {
  let worker: Worker | null = null;

  const initWorker = () => {
    if (worker) return worker;
    
    // Using the stockfish.js worker from the public directory
    worker = new Worker('/engine/stockfish.js');
    
    worker.onmessage = (e) => {
      const line = e.data;
      
      // Parse evaluation
      if (line.startsWith('info depth')) {
        const scoreMatch = line.match(/score cp (-?\d+)/);
        const mateMatch = line.match(/score mate (-?\d+)/);
        
        if (scoreMatch || mateMatch) {
          // We need to know whose turn it is to normalize the score to White advantage
          // This is a bit tricky since we don't have the FEN here.
          // We'll handle normalization in analyzePosition or by passing the side to move.
          
          if (scoreMatch) {
            const cp = parseInt(scoreMatch[1]);
            set({ 
              evaluation: cp / 100 
            });
          } else if (mateMatch) {
            const mateIn = parseInt(mateMatch[1]);
            set({ evaluation: mateIn > 0 ? 100 : -100 });
          }
        }
      }
      
      if (line.startsWith('bestmove')) {
        const move = line.split(' ')[1];
        set({ bestMove: move, isThinking: false });
      }
    };

    worker.postMessage('uci');
    worker.postMessage('isready');
    
    return worker;
  };

  return {
    evaluation: 0,
    bestMove: null,
    isThinking: false,
    enabled: true,

    toggleEnabled: () => set((s) => ({ enabled: !s.enabled })),

    analyzePosition: (fen) => {
      if (!get().enabled) return;
      
      const w = initWorker();
      const isBlackTurn = fen.split(' ')[1] === 'b';
      
      set({ isThinking: true, bestMove: null });
      
      // Override onmessage to handle turn normalization
      w.onmessage = (e) => {
        const line = e.data;
        if (line.startsWith('info depth')) {
          const scoreMatch = line.match(/score cp (-?\d+)/);
          const mateMatch = line.match(/score mate (-?\d+)/);
          
          if (scoreMatch) {
            let cp = parseInt(scoreMatch[1]);
            if (isBlackTurn) cp = -cp; // Normalize to White advantage
            set({ evaluation: cp / 100 });
          } else if (mateMatch) {
            let mateIn = parseInt(mateMatch[1]);
            if (isBlackTurn) mateIn = -mateIn;
            set({ evaluation: mateIn > 0 ? 100 : -100 });
          }
        }
        
        if (line.startsWith('bestmove')) {
          const move = line.split(' ')[1];
          set({ bestMove: move, isThinking: false });
        }
      };

      w.postMessage('stop');
      w.postMessage(`position fen ${fen}`);
      w.postMessage('go depth 15');
    },

    stopAnalysis: () => {
      if (worker) {
        worker.postMessage('stop');
        set({ isThinking: false });
      }
    },
  };
});
