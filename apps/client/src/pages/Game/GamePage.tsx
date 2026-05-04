import { useEffect, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import { useGameStore } from '../../stores/gameStore';
import { useAuthStore } from '../../stores/authStore';
import {
  PlayerCard,
  MoveHistory,
  GameOverModal,
  EvaluationBar,
} from '../../components/Game/GameComponents';
import { ChatPanel } from '../../components/Game/ChatPanel';
import { motion } from 'framer-motion';
import type { Square } from 'react-chessboard/dist/chessboard/types';
import { LogOut } from 'lucide-react';

export function GamePage() {
  const user = useAuthStore((s) => s.user);
  const {
    phase,
    fen,
    turn,
    playerColor,
    isSpectating,
    whitePlayerName,
    whitePlayerRating,
    blackPlayerName,
    blackPlayerRating,
    whiteTimeMs,
    blackTimeMs,
    lastMove,
    evaluation,
    opponentDisconnected,
    makeMove,
    resetGame,
    resign,
    initSocketListeners,
    cleanupSocketListeners,
  } = useGameStore();

  useEffect(() => {
    initSocketListeners();
    return () => cleanupSocketListeners();
  }, [initSocketListeners, cleanupSocketListeners]);

  const onDrop = useCallback(
    (sourceSquare: Square, targetSquare: Square, piece: string): boolean => {
      if (isSpectating) return false;
      if (!playerColor || turn !== playerColor) return false;
      const pieceColor = piece[0] === 'w' ? 'w' : 'b';
      if (pieceColor !== playerColor) return false;

      const isPromotion =
        piece[1] === 'P' &&
        ((pieceColor === 'w' && targetSquare[1] === '8') ||
         (pieceColor === 'b' && targetSquare[1] === '1'));

      makeMove({
        from: sourceSquare,
        to: targetSquare,
        promotion: isPromotion ? 'q' : undefined,
      });

      return false;
    },
    [playerColor, turn, makeMove, isSpectating]
  );

  if (!user) return null;

  const boardOrientation = playerColor === 'b' ? 'black' : 'white';
  const isPlayerWhite = playerColor === 'w' || isSpectating; // Default to white view for spectators
  
  // Logic for top/bottom players
  const topPlayer = isPlayerWhite ? {
    name: blackPlayerName || 'Black',
    rating: blackPlayerRating || 1200,
    time: blackTimeMs,
    isActive: turn === 'b',
    color: 'b' as const
  } : {
    name: whitePlayerName || 'White',
    rating: whitePlayerRating || 1200,
    time: whiteTimeMs,
    isActive: turn === 'w',
    color: 'w' as const
  };

  const bottomPlayer = isPlayerWhite ? {
    name: whitePlayerName || 'White',
    rating: whitePlayerRating || 1200,
    time: whiteTimeMs,
    isActive: turn === 'w',
    color: 'w' as const
  } : {
    name: blackPlayerName || 'Black',
    rating: blackPlayerRating || 1200,
    time: blackTimeMs,
    isActive: turn === 'b',
    color: 'b' as const
  };

  const customSquareStyles: Record<string, React.CSSProperties> = {};
  if (lastMove) {
    customSquareStyles[lastMove.from] = { backgroundColor: 'rgba(255, 255, 255, 0.15)' };
    customSquareStyles[lastMove.to] = { backgroundColor: 'rgba(255, 255, 255, 0.15)' };
  }

  return (
    <div className="min-h-screen pt-28 pb-10 px-8 relative z-10">
      {/* Overlays */}
      {phase === 'gameOver' && <GameOverModal />}

      {/* Opponent disconnect banner */}
      {opponentDisconnected && !isSpectating && (
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-white text-black px-6 py-2 rounded-full text-xs font-bold tracking-widest uppercase shadow-2xl"
        >
          ⚠️ Opponent disconnected • Waiting...
        </motion.div>
      )}

      {/* Spectator Indicator */}
      {isSpectating && (
        <motion.div 
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed top-24 left-1/2 -translate-x-1/2 z-50 bg-white/[0.05] backdrop-blur-xl border border-white/10 text-white px-6 py-2 rounded-full text-[10px] font-bold tracking-widest uppercase flex items-center gap-2 shadow-2xl"
        >
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Live Spectating
        </motion.div>
      )}

      {/* Game layout — Cinematic Theater Mode */}
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col lg:flex-row gap-10 items-stretch justify-center">
          
          {/* Left: The Arena (Board + Clocks) */}
          <motion.div 
            initial={{ scale: 0.98, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col gap-6 w-full max-w-[640px]"
          >
            {/* Top HUD */}
            <PlayerCard
              timeMs={topPlayer.time}
              isActive={topPlayer.isActive && phase === 'playing'}
              color={topPlayer.color}
              playerName={topPlayer.name}
              rating={topPlayer.rating}
              fen={fen}
            />

            {/* The Board + Eval Bar */}
            <div className="flex gap-4 items-stretch h-full">
              <EvaluationBar score={evaluation} isSpectating={isSpectating} />
              
              <div className="aspect-square flex-1 rounded-[40px] overflow-hidden shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] border border-white/10 bg-zinc-900 group relative">
                <Chessboard
                  position={fen}
                  onPieceDrop={onDrop}
                  boardOrientation={boardOrientation}
                  customSquareStyles={customSquareStyles}
                  customDarkSquareStyle={{ backgroundColor: '#27272a' }}
                  customLightSquareStyle={{ backgroundColor: '#d4d4d8' }}
                  animationDuration={250}
                  customBoardStyle={{ borderRadius: '40px' }}
                  arePiecesDraggable={!isSpectating}
                />
                {isSpectating && (
                  <div className="absolute inset-0 z-20 pointer-events-none border-[12px] border-white/5 rounded-[40px]" />
                )}
              </div>
            </div>

            {/* Bottom HUD */}
            <PlayerCard
              timeMs={bottomPlayer.time}
              isActive={bottomPlayer.isActive && phase === 'playing'}
              color={bottomPlayer.color}
              playerName={bottomPlayer.name}
              rating={bottomPlayer.rating}
              fen={fen}
            />
          </motion.div>

          {/* Right: Intelligence Panel (History + Chat) */}
          <motion.div 
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="w-full lg:w-[400px] flex flex-col gap-6"
          >
            <div className="h-[240px]">
              <MoveHistory />
            </div>

            <div className="flex-1 min-h-[300px]">
              <ChatPanel />
            </div>

            {/* Meta Actions */}
            <div className="flex gap-4">
              {isSpectating ? (
                <button
                  onClick={resetGame}
                  className="btn-primary flex-1 text-xs font-bold tracking-widest uppercase flex items-center justify-center gap-2"
                >
                  <LogOut size={16} />
                  Stop Watching
                </button>
              ) : (
                <button
                  onClick={resign}
                  className="btn-secondary flex-1 text-xs font-bold tracking-widest uppercase border-white/5 hover:border-white/20"
                >
                  Resign
                </button>
              )}
              <button className="btn-secondary w-14 flex items-center justify-center p-0">
                ⚙️
              </button>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
