import { useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import { useComputerGameStore } from '../../stores/computerGameStore';
import { useAuthStore } from '../../stores/authStore';
import { PlayerCard, MoveHistory as MultplayerMoveHistory } from '../../components/Game/GameComponents';
import { motion, AnimatePresence } from 'framer-motion';
import type { Square } from 'react-chessboard/dist/chessboard/types';

// ─────────────────────────────────────────────────────────
// Computer Game Page
// ─────────────────────────────────────────────────────────
// Renders the chessboard for "Play vs Computer" games.
// Reuses the same visual components as the multiplayer
// GamePage, but drives state from computerGameStore.

export function ComputerGamePage() {
  const user = useAuthStore((s) => s.user);
  const {
    phase,
    difficulty,
    fen,
    turn,
    playerColor,
    lastMove,
    isThinking,
    pgn,
    moveCount,
    gameResult,
    makeMove,
    resign,
    resetGame,
  } = useComputerGameStore();

  // Handle piece drop
  const onDrop = useCallback(
    (sourceSquare: Square, targetSquare: Square, piece: string): boolean => {
      if (!playerColor) return false;
      if (turn !== playerColor) return false;
      if (phase !== 'playing') return false;

      // Check if this is the player's piece
      const pieceColor = piece[0] === 'w' ? 'w' : 'b';
      if (pieceColor !== playerColor) return false;

      // Determine if promotion
      const isPromotion =
        piece[1] === 'P' &&
        ((pieceColor === 'w' && targetSquare[1] === '8') ||
         (pieceColor === 'b' && targetSquare[1] === '1'));

      makeMove({
        from: sourceSquare,
        to: targetSquare,
        promotion: isPromotion ? 'q' : undefined,
      });

      return true; // Local game — update board immediately
    },
    [playerColor, turn, phase, makeMove],
  );

  if (!user) return null;

  // Board orientation
  const boardOrientation = playerColor === 'b' ? 'black' : 'white';
  const isPlayerTurn = turn === playerColor;

  // Difficulty label
  const difficultyLabel = {
    easy: 'Easy',
    medium: 'Medium',
    hard: 'Hard',
  }[difficulty];

  const difficultyEmoji = {
    easy: '🟢',
    medium: '🟡',
    hard: '🔴',
  }[difficulty];

  // Highlight last move squares
  const customSquareStyles: Record<string, React.CSSProperties> = {};
  if (lastMove) {
    customSquareStyles[lastMove.from] = {
      backgroundColor: 'rgba(255, 255, 0, 0.25)',
    };
    customSquareStyles[lastMove.to] = {
      backgroundColor: 'rgba(255, 255, 0, 0.25)',
    };
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-accent-purple/6 blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-[300px] h-[300px] rounded-full bg-accent-cyan/6 blur-[80px]" />
      </div>

      {/* Game Over Modal */}
      <AnimatePresence>
        {phase === 'gameOver' && gameResult && (
          <ComputerGameOverModal
            result={gameResult}
            onNewGame={resetGame}
          />
        )}
      </AnimatePresence>

      {/* Game layout */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6 items-start justify-center">
          {/* Left: Board + Info */}
          <div className="flex flex-col gap-3 w-full max-w-lg">
            {/* Opponent info (Computer) */}
            <div className="relative">
              <PlayerCard
                timeMs={undefined as any}
                isActive={!isPlayerTurn && phase === 'playing'}
                color={playerColor === 'w' ? 'b' : 'w'}
                playerName="Computer"
                rating={`${difficultyEmoji} ${difficultyLabel}`}
                isComputer={true}
                fen={fen}
              />
              {/* Thinking indicator overlay */}
              <AnimatePresence>
                {isThinking && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="absolute top-1/2 -translate-y-1/2 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10"
                  >
                    <span className="text-xs font-medium text-white/80">Thinking</span>
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <motion.div
                          key={i}
                          className="w-1 h-1 rounded-full bg-accent-cyan"
                          animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                          transition={{
                            duration: 0.6,
                            repeat: Infinity,
                            delay: i * 0.15,
                          }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Chess Board */}
            <div className="aspect-square w-full rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)] border border-white/5">
              <Chessboard
                position={fen}
                onPieceDrop={onDrop}
                boardOrientation={boardOrientation}
                customSquareStyles={customSquareStyles}
                customDarkSquareStyle={{ backgroundColor: '#3f3f46' }}
                customLightSquareStyle={{ backgroundColor: '#e4e4e7' }}
                animationDuration={150}
                arePiecesDraggable={isPlayerTurn && phase === 'playing' && !isThinking}
              />
            </div>

            {/* Player info */}
            <PlayerCard
              timeMs={undefined as any}
              isActive={isPlayerTurn && phase === 'playing'}
              color={playerColor || 'w'}
              playerName={user.username}
              rating={user.eloRating}
              fen={fen}
            />
          </div>

          {/* Right: Move history + Controls */}
          <div className="w-full lg:w-72 flex flex-col gap-3">
            {/* Move History */}
            <ComputerMoveHistory pgn={pgn} moveCount={moveCount} />

            {/* Game controls */}
            {phase === 'playing' && (
              <div className="flex gap-2">
                <button
                  onClick={resign}
                  className="btn-danger flex-1 text-sm py-2.5"
                >
                  🏳️ Resign
                </button>
                <button
                  onClick={resetGame}
                  className="btn-secondary flex-1 text-sm py-2.5"
                >
                  ✕ Quit
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
// Computer Move History (local version)
// ─────────────────────────────────────────────────────────

function ComputerMoveHistory({ pgn, moveCount }: { pgn: string; moveCount: number }) {
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

      <div className="flex-1 overflow-y-auto space-y-1 min-h-0 max-h-64">
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
// Computer Game Over Modal
// ─────────────────────────────────────────────────────────

interface GameOverModalProps {
  result: {
    result: string;
    winnerId: string | null;
    pgn: string;
  };
  onNewGame: () => void;
}

function ComputerGameOverModal({ result, onNewGame }: GameOverModalProps) {
  const resultText = {
    WHITE_WINS: '⬜ White Wins',
    BLACK_WINS: '⬛ Black Wins',
    DRAW: '🤝 Draw',
    TIMEOUT: '⏱️ Timeout',
    RESIGNATION: '🏳️ Resignation',
    ABANDONMENT: '💨 Abandonment',
  }[result.result] || result.result;

  const outcomeText =
    result.winnerId === 'player'
      ? '🎉 You Won!'
      : result.winnerId === 'computer'
        ? '💻 Computer Wins'
        : '🤝 It\'s a Draw';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="glass-card p-8 max-w-sm w-full text-center"
      >
        <h2 className="text-3xl font-bold gradient-text mb-2">Game Over</h2>
        <p className="text-2xl text-text-primary mb-1">{outcomeText}</p>
        <p className="text-sm text-text-muted mb-8">{resultText}</p>

        <div className="flex gap-3 justify-center">
          <button onClick={onNewGame} className="btn-primary">
            🔄 New Game
          </button>
          <button onClick={onNewGame} className="btn-secondary">
            ← Back to Lobby
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
