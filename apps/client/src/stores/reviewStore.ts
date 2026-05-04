import { create } from 'zustand';
import { Chess } from 'chess.js';
import { api } from '../services/api';

interface ReviewPlayer {
  username: string;
  eloRating: number;
}

interface AnalysisMove {
  moveIndex: number;
  fen: string;
  score: number;
  bestMove: string;
  movePlayed: string | null;
}

interface ReviewState {
  gameId: string | null;
  pgn: string;
  moves: string[];
  fens: string[];
  currentIndex: number;
  
  whitePlayer: ReviewPlayer | null;
  blackPlayer: ReviewPlayer | null;
  
  // Analysis
  isAnalyzing: boolean;
  analysis: AnalysisMove[] | null;
  accuracy: { white: number; black: number } | null;
  
  loadGame: (gameId: string | null, pgn: string, white: ReviewPlayer, black: ReviewPlayer) => void;
  triggerAnalysis: () => Promise<void>;
  nextMove: () => void;
  prevMove: () => void;
  jumpToMove: (index: number) => void;
  resetReview: () => void;
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  gameId: null,
  pgn: '',
  moves: [],
  fens: [],
  currentIndex: 0,
  whitePlayer: null,
  blackPlayer: null,
  
  isAnalyzing: false,
  analysis: null,
  accuracy: null,

  loadGame: (gameId, pgn, white, black) => {
    const chess = new Chess();
    try {
      chess.loadPgn(pgn);
      const history = chess.history();
      
      const replayer = new Chess();
      const fens = [replayer.fen()];
      
      for (const move of history) {
        replayer.move(move);
        fens.push(replayer.fen());
      }

      set({
        gameId,
        pgn,
        moves: history,
        fens,
        currentIndex: fens.length - 1,
        whitePlayer: white,
        blackPlayer: black,
        analysis: null,
        accuracy: null,
      });
    } catch (err) {
      console.error('Failed to parse PGN for review', err);
    }
  },

  triggerAnalysis: async () => {
    const { gameId } = get();
    if (!gameId) return;

    set({ isAnalyzing: true });
    try {
      const response = await api.post<{ analysis: AnalysisMove[]; accuracy: { white: number; black: number } }>(
        `/games/${gameId}/analyze`
      );
      set({ 
        analysis: response.analysis,
        accuracy: response.accuracy,
        isAnalyzing: false 
      });
    } catch (err) {
      console.error('Analysis failed', err);
      set({ isAnalyzing: false });
    }
  },

  nextMove: () => {
    const { currentIndex, fens } = get();
    if (currentIndex < fens.length - 1) {
      set({ currentIndex: currentIndex + 1 });
    }
  },

  prevMove: () => {
    const { currentIndex } = get();
    if (currentIndex > 0) {
      set({ currentIndex: currentIndex - 1 });
    }
  },

  jumpToMove: (index) => {
    const { fens } = get();
    if (index >= 0 && index < fens.length) {
      set({ currentIndex: index });
    }
  },

  resetReview: () => {
    set({
      gameId: null,
      pgn: '',
      moves: [],
      fens: [],
      currentIndex: 0,
      whitePlayer: null,
      blackPlayer: null,
      analysis: null,
      accuracy: null,
      isAnalyzing: false,
    });
  },
}));
