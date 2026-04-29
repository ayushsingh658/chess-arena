import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../../stores/gameStore';
import type { PieceColor } from '@chess-arena/shared';

// ─────────────────────────────────────────────────────────
// Chess Clock Component
// ─────────────────────────────────────────────────────────
// Displays time for a single player with live countdown.
// The server is authoritative — this is only a visual timer
// that syncs on each GAME_UPDATE from the server.

interface ClockProps {
  timeMs: number;
  isActive: boolean;
  color: PieceColor;
  playerName: string;
  rating: number;
}

export function ChessClock({ timeMs, isActive, color, playerName, rating }: ClockProps) {
  const [displayTime, setDisplayTime] = useState(timeMs);
  const lastUpdateRef = useRef(Date.now());

  // Sync with server time on each update
  useEffect(() => {
    setDisplayTime(timeMs);
    lastUpdateRef.current = Date.now();
  }, [timeMs]);

  // Local countdown for smooth display (purely visual)
  useEffect(() => {
    if (!isActive || displayTime <= 0) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastUpdateRef.current;
      const remaining = Math.max(0, timeMs - elapsed);
      setDisplayTime(remaining);
    }, 100);

    return () => clearInterval(interval);
  }, [isActive, timeMs]);

  const minutes = Math.floor(displayTime / 60000);
  const seconds = Math.floor((displayTime % 60000) / 1000);
  const tenths = Math.floor((displayTime % 1000) / 100);

  const isLow = displayTime < 30000; // Under 30 seconds
  const isCritical = displayTime < 10000; // Under 10 seconds

  return (
    <div
      className={`
        glass-card p-4 flex items-center justify-between transition-all duration-300
        ${isActive ? 'border-accent-cyan/40 shadow-[0_0_15px_rgba(0,212,255,0.15)]' : 'opacity-70'}
        ${isCritical && isActive ? 'border-danger/50 animate-pulse' : ''}
      `}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-3 h-3 rounded-full ${
            color === 'w' ? 'bg-white' : 'bg-gray-800 border border-gray-600'
          }`}
        />
        <div>
          <p className="text-sm font-medium text-text-primary">{playerName}</p>
          <p className="text-xs text-text-muted">{rating} Elo</p>
        </div>
      </div>

      <div
        className={`
          font-mono text-2xl font-bold tabular-nums
          ${isCritical ? 'text-danger' : isLow ? 'text-warning' : 'text-text-primary'}
        `}
      >
        {minutes}:{seconds.toString().padStart(2, '0')}
        {displayTime < 60000 && (
          <span className="text-lg opacity-60">.{tenths}</span>
        )}
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

  // Auto-scroll to bottom on new moves
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [pgn]);

  // Parse PGN into move pairs
  const moves = pgn
    ? pgn
        .replace(/\d+\.\s*/g, '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
    : [];

  const movePairs: Array<[string, string?]> = [];
  for (let i = 0; i < moves.length; i += 2) {
    movePairs.push([moves[i]!, moves[i + 1]]);
  }

  return (
    <div className="glass-card p-4 flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-secondary">Moves</h3>
        <span className="text-xs text-text-muted">{moveCount} moves</span>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-1 min-h-0 max-h-64"
      >
        {movePairs.length === 0 ? (
          <p className="text-text-muted text-xs text-center py-4">
            No moves yet
          </p>
        ) : (
          movePairs.map((pair, i) => (
            <div
              key={i}
              className="flex items-center text-sm gap-2 px-2 py-0.5 rounded hover:bg-white/5"
            >
              <span className="text-text-muted w-6 text-right text-xs">
                {i + 1}.
              </span>
              <span className="text-text-primary font-mono w-16">{pair[0]}</span>
              <span className="text-text-primary font-mono w-16">
                {pair[1] || ''}
              </span>
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
  const { gameResult, resetGame } = useGameStore();

  if (!gameResult) return null;

  const resultText = {
    WHITE_WINS: '⬜ White Wins',
    BLACK_WINS: '⬛ Black Wins',
    DRAW: '🤝 Draw',
    TIMEOUT: '⏱️ Timeout',
    RESIGNATION: '🏳️ Resignation',
    ABANDONMENT: '💨 Abandonment',
  }[gameResult.result] || gameResult.result;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-card p-8 max-w-sm w-full text-center animate-[float_3s_infinite]">
        <h2 className="text-3xl font-bold gradient-text mb-2">Game Over</h2>
        <p className="text-xl text-text-primary mb-6">{resultText}</p>

        {gameResult.eloChange !== 0 && (
          <p
            className={`text-lg font-bold mb-4 ${
              gameResult.eloChange > 0 ? 'text-success' : 'text-danger'
            }`}
          >
            {gameResult.eloChange > 0 ? '+' : ''}{gameResult.eloChange} Elo
          </p>
        )}

        <div className="flex gap-3 justify-center">
          <button onClick={resetGame} className="btn-primary">
            🔄 New Game
          </button>
          <button onClick={resetGame} className="btn-secondary">
            📊 Review
          </button>
        </div>
      </div>
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="glass-card p-10 max-w-sm w-full text-center">
        {/* Animated pulsing chess piece */}
        <div className="text-6xl mb-6 animate-[float_2s_infinite]">♟</div>

        <h2 className="text-xl font-bold text-text-primary mb-2">
          Finding opponent...
        </h2>
        <p className="text-text-muted mb-6">
          Matching players with similar rating
        </p>

        {/* Timer */}
        <div className="text-3xl font-mono font-bold text-accent-cyan mb-8 tabular-nums">
          {minutes}:{displaySeconds.toString().padStart(2, '0')}
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-8">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2.5 h-2.5 rounded-full bg-accent-cyan animate-pulse"
              style={{ animationDelay: `${i * 0.3}s` }}
            />
          ))}
        </div>

        <button onClick={cancelMatch} className="btn-danger">
          ✕ Cancel
        </button>
      </div>
    </div>
  );
}
