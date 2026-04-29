import { useEffect, useCallback } from 'react';
import { Chessboard } from 'react-chessboard';
import { useGameStore } from '../../stores/gameStore';
import { useAuthStore } from '../../stores/authStore';
import {
  ChessClock,
  MoveHistory,
  GameOverModal,
  SearchingOverlay,
} from '../../components/Game/GameComponents';
import type { Square } from 'react-chessboard/dist/chessboard/types';

// ─────────────────────────────────────────────────────────
// Game Page
// ─────────────────────────────────────────────────────────
// The core game screen with:
//   - Chessboard (react-chessboard)
//   - Two clocks (opponent top, player bottom)
//   - Move history panel
//   - Resign button
//
// The board is oriented based on the player's color.
// Moves are sent to the server for validation — the board
// only updates when the server broadcasts GAME_UPDATE.

export function GamePage() {
  const user = useAuthStore((s) => s.user);
  const {
    phase,
    fen,
    turn,
    playerColor,
    opponentName,
    opponentRating,
    whiteTimeMs,
    blackTimeMs,
    lastMove,
    opponentDisconnected,
    makeMove,
    resign,
    initSocketListeners,
    cleanupSocketListeners,
  } = useGameStore();

  // Set up socket listeners when game page mounts
  useEffect(() => {
    initSocketListeners();
    return () => cleanupSocketListeners();
  }, [initSocketListeners, cleanupSocketListeners]);

  // Handle piece drop
  const onDrop = useCallback(
    (sourceSquare: Square, targetSquare: Square, piece: string): boolean => {
      // Only allow moves on player's turn
      if (!playerColor) return false;
      if (turn !== playerColor) return false;

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
        promotion: isPromotion ? 'q' : undefined, // Auto-promote to queen
      });

      // Return false — don't update board locally.
      // The board updates only when the server confirms via GAME_UPDATE.
      // This IS the authoritative server pattern.
      return false;
    },
    [playerColor, turn, makeMove]
  );

  if (!user) return null;

  // Determine board orientation
  const boardOrientation = playerColor === 'b' ? 'black' : 'white';

  // Determine opponent and player info
  const isPlayerWhite = playerColor === 'w';
  const playerTimeMs = isPlayerWhite ? whiteTimeMs : blackTimeMs;
  const opponentTimeMs = isPlayerWhite ? blackTimeMs : whiteTimeMs;
  const isPlayerTurn = turn === playerColor;

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

      {/* Overlays */}
      {phase === 'searching' && <SearchingOverlay />}
      {phase === 'gameOver' && <GameOverModal />}

      {/* Opponent disconnect banner */}
      {opponentDisconnected && (
        <div className="fixed top-0 left-0 right-0 z-40 bg-warning/90 text-black text-center py-2 text-sm font-medium">
          ⚠️ Opponent disconnected — waiting for reconnection...
        </div>
      )}

      {/* Game layout */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex flex-col lg:flex-row gap-6 items-start justify-center">
          {/* Left: Board + Clocks */}
          <div className="flex flex-col gap-3 w-full max-w-lg">
            {/* Opponent clock (top) */}
            <ChessClock
              timeMs={opponentTimeMs}
              isActive={!isPlayerTurn && phase === 'playing'}
              color={playerColor === 'w' ? 'b' : 'w'}
              playerName={opponentName || 'Opponent'}
              rating={opponentRating || 1200}
            />

            {/* Chess Board */}
            <div className="aspect-square w-full rounded-lg overflow-hidden shadow-2xl">
              <Chessboard
                position={fen}
                onPieceDrop={onDrop}
                boardOrientation={boardOrientation}
                customSquareStyles={customSquareStyles}
                customDarkSquareStyle={{ backgroundColor: '#7b6b5a' }}
                customLightSquareStyle={{ backgroundColor: '#e8dcc8' }}
                animationDuration={200}
              />
            </div>

            {/* Player clock (bottom) */}
            <ChessClock
              timeMs={playerTimeMs}
              isActive={isPlayerTurn && phase === 'playing'}
              color={playerColor || 'w'}
              playerName={user.username}
              rating={user.eloRating}
            />
          </div>

          {/* Right: Move history + Controls */}
          <div className="w-full lg:w-72 flex flex-col gap-3">
            <MoveHistory />

            {/* Game controls */}
            {phase === 'playing' && (
              <div className="flex gap-2">
                <button
                  onClick={resign}
                  className="btn-danger flex-1 text-sm py-2.5"
                >
                  🏳️ Resign
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
