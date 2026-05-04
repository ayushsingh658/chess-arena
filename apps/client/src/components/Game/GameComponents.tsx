import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import { useAuthStore } from '../../stores/authStore';
import { useReviewStore } from '../../stores/reviewStore';
import { getMaterialAdvantage, type CapturedPieces } from '../../utils/chess';
import type { PieceColor } from '@chess-arena/shared';
import { motion } from 'framer-motion';

// ─────────────────────────────────────────────────────────
// Player Card HUD
// ─────────────────────────────────────────────────────────

interface PlayerCardProps {
  timeMs: number;
  isActive: boolean;
  color: PieceColor;
  playerName: string;
  rating: number | string;
  isComputer?: boolean;
  fen?: string;
}

export function PlayerCard({ timeMs, isActive, color, playerName, rating, isComputer, fen }: PlayerCardProps) {
  const [displayTime, setDisplayTime] = useState(timeMs ?? 0);
  const lastUpdateRef = useRef(Date.now());

  useEffect(() => {
    if (timeMs !== undefined) {
      setDisplayTime(timeMs);
      lastUpdateRef.current = Date.now();
    }
  }, [timeMs]);

  useEffect(() => {
    if (!isActive || timeMs === undefined || displayTime <= 0) return;
    const interval = setInterval(() => {
      const elapsed = Date.now() - lastUpdateRef.current;
      setDisplayTime(Math.max(0, timeMs - elapsed));
    }, 100);
    return () => clearInterval(interval);
  }, [isActive, timeMs]);

  const minutes = Math.floor(displayTime / 60000);
  const seconds = Math.floor((displayTime % 60000) / 1000);
  const tenths = Math.floor((displayTime % 1000) / 100);

  const isLow = displayTime < 30000;
  const isCritical = displayTime < 10000;

  let advantage = 0;
  let captured: CapturedPieces = { p: 0, n: 0, b: 0, r: 0, q: 0 };
  
  if (fen) {
    const mat = getMaterialAdvantage(fen);
    advantage = color === 'w' ? mat.white : mat.black;
    captured = color === 'w' ? mat.blackCaptured : mat.whiteCaptured;
  }

  const pieceIcons = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛' };
  const pieceOrder: (keyof CapturedPieces)[] = ['p', 'n', 'b', 'r', 'q'];

  return (
    <div
      className={`
        glass-card flex flex-col transition-all duration-700 overflow-hidden relative
        ${isActive ? 'bg-white/[0.04] border-white/20' : 'bg-black/20 opacity-60'}
      `}
    >
      {/* Active turn pulse */}
      {isActive && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.1, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute inset-0 bg-white"
        />
      )}

      <div className="flex items-center justify-between p-5 relative z-10">
        <div className="flex items-center gap-5">
          {/* Avatar */}
          <div className="relative">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-2xl transition-all duration-500 ${color === 'w' ? 'bg-white text-black' : 'bg-zinc-800 text-white'}`}>
              {isComputer ? '🤖' : color === 'w' ? '♔' : '♚'}
            </div>
            {isActive && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-white border-2 border-bg-primary rounded-full animate-pulse" />
            )}
          </div>
          
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold text-white tracking-tight">{playerName}</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-text-muted border border-white/5 uppercase tracking-widest">
                {rating}
              </span>
            </div>
            
            {/* Captured Pieces */}
            <div className="flex items-center gap-1.5 mt-1.5 h-5">
              {pieceOrder.map((p) => {
                const count = captured[p];
                if (count === 0) return null;
                return (
                  <span key={p} className="text-text-muted text-sm flex tracking-tighter opacity-80">
                    {Array(count).fill(pieceIcons[p]).join('')}
                  </span>
                );
              })}
              {advantage > 0 && (
                <span className="text-white text-xs font-bold ml-1 opacity-40">+{advantage}</span>
              )}
            </div>
          </div>
        </div>

        {/* Clock */}
        {timeMs !== undefined && (
          <div
            className={`
              font-mono text-4xl font-bold tabular-nums tracking-tighter transition-all duration-500
              ${isCritical ? 'text-danger' : isLow ? 'text-white' : isActive ? 'text-white' : 'text-text-muted'}
            `}
          >
            {minutes}:{seconds.toString().padStart(2, '0')}
            {displayTime < 60000 && (
              <span className="text-2xl opacity-40">.{tenths}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Evaluation Bar (Spectator Mode)
// ─────────────────────────────────────────────────────────

export function EvaluationBar({ score, isSpectating }: { score: number; isSpectating: boolean }) {
  if (!isSpectating) return null;

  // Map centipawn score to 0-100%
  // 0 = equal (50%), +600 = white winning (90%), -600 = black winning (10%)
  const percentage = 50 + 50 * (2 / (1 + Math.exp(-score / 400)) - 1);
  const displayScore = score > 0 ? `+${(score / 100).toFixed(1)}` : (score / 100).toFixed(1);

  return (
    <div className="w-1.5 h-full bg-zinc-800 rounded-full overflow-hidden relative border border-white/5 shadow-2xl">
      <motion.div
        animate={{ height: `${percentage}%` }}
        transition={{ type: 'spring', damping: 20, stiffness: 60 }}
        className="absolute bottom-0 left-0 right-0 bg-white"
      />
      
      {/* Score Indicator */}
      <div className={`absolute left-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 ${percentage > 50 ? 'text-white' : 'text-zinc-500'}`}>
        <span className="text-[10px] font-bold tabular-nums tracking-tighter bg-black/40 px-1.5 py-0.5 rounded border border-white/5 backdrop-blur-md">
          {displayScore}
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Move History Panel
// ─────────────────────────────────────────────────────────

export function MoveHistory() {
  const { pgn, moveCount } = useGameStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [pgn]);

  const moves = pgn ? pgn.replace(/\d+\.\s*/g, '').trim().split(/\s+/).filter(Boolean) : [];
  const movePairs: Array<[string, string?]> = [];
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push([moves[i]!, moves[i + 1]]);
  }

  return (
    <div className="glass-card flex flex-col h-full bg-black/40">
      <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-[10px] font-bold text-text-muted uppercase tracking-[0.3em]">Timeline</h3>
        <span className="text-[10px] font-bold text-white tabular-nums opacity-40">{moveCount} Moves</span>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-1">
        {movePairs.length === 0 ? (
          <p className="text-text-muted text-xs text-center py-4">No moves played</p>
        ) : (
          movePairs.map((pair, i) => (
            <div key={i} className="flex items-center text-sm gap-4 py-1 group">
              <span className="text-[10px] text-text-muted w-6 text-right font-bold tabular-nums">{i + 1}.</span>
              <span className="text-white font-mono w-16 group-hover:bg-white/[0.05] rounded px-2 transition-colors cursor-pointer">{pair[0]}</span>
              <span className="text-white font-mono w-16 group-hover:bg-white/[0.05] rounded px-2 transition-colors cursor-pointer">{pair[1] || ''}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Game Over Modal
// ─────────────────────────────────────────────────────────

export function GameOverModal() {
  const { gameResult, resetGame, opponentName, playerColor } = useGameStore();
  const { user } = useAuthStore();
  const loadReview = useReviewStore((s) => s.loadGame);

  if (!gameResult) return null;

  const handleReview = () => {
    const white = playerColor === 'w' ? user! : { username: opponentName!, eloRating: 0 };
    const black = playerColor === 'b' ? user! : { username: opponentName!, eloRating: 0 };
    loadReview(useGameStore.getState().gameId, gameResult.pgn, white, black);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-xl">
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="max-w-md w-full text-center px-8"
      >
        <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-text-muted mb-4">End of Battle</p>
        <h2 className="text-6xl font-bold tracking-tighter text-white mb-8">
          {gameResult.result.replace('_', ' ')}
        </h2>

        {gameResult.eloChange !== 0 && (
          <div className="inline-block px-6 py-2 rounded-full bg-white/5 border border-white/10 mb-10">
            <span className="text-lg font-bold text-white">
              {gameResult.eloChange > 0 ? '+' : ''}{gameResult.eloChange} Elo Point
            </span>
          </div>
        )}

        <div className="flex flex-col gap-4 items-stretch">
          <button onClick={resetGame} className="btn-primary py-5">
            Play Again
          </button>
          <button onClick={handleReview} className="btn-secondary py-5">
            Analyze Match
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Searching Animation
// ─────────────────────────────────────────────────────────

export function SearchingOverlay() {
  const { searchTimeMs, cancelMatch } = useGameStore();
  const seconds = Math.floor(searchTimeMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const displaySeconds = seconds % 60;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-2xl">
      <div className="flex flex-col items-center max-w-sm w-full text-center">
        <div className="relative flex items-center justify-center w-64 h-64 mb-16">
          <div className="absolute inset-0 m-auto w-24 h-24 bg-white/5 rounded-full border border-white/10 shadow-[0_0_60px_rgba(255,255,255,0.05)]" />
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="absolute inset-0 m-auto w-24 h-24 border border-white/20 rounded-[40px]"
              initial={{ scale: 0.8, opacity: 1, rotate: 0 }}
              animate={{ scale: 3, opacity: 0, rotate: 45 }}
              transition={{ duration: 4, repeat: Infinity, delay: i * 1.3, ease: "easeOut" }}
            />
          ))}
          <div className="text-6xl relative z-10">♟</div>
        </div>

        <h2 className="text-3xl font-bold text-white mb-2 tracking-tighter italic">Locating Rival...</h2>
        <div className="text-lg font-mono font-bold text-text-muted mb-12 tabular-nums tracking-widest opacity-40">
          {minutes}:{displaySeconds.toString().padStart(2, '0')}
        </div>

        <button onClick={cancelMatch} className="px-10 py-4 rounded-full border border-white/10 text-text-muted hover:text-white hover:border-white/30 transition-all font-bold text-xs uppercase tracking-widest">
          Abandon Search
        </button>
      </div>
    </div>
  );
}
