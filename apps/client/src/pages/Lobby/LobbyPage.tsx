import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useGameStore } from '../../stores/gameStore';
import { useComputerGameStore } from '../../stores/computerGameStore';
import { TIME_CONTROLS } from '@chess-arena/shared';
import { Monitor, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { PieceColor } from '@chess-arena/shared';
import type { Difficulty } from '../../services/chessEngine';

type PlayMode = 'online' | 'computer';

export function LobbyPage() {
  const { user } = useAuthStore();
  const { findMatch, phase } = useGameStore();
  const computerGame = useComputerGameStore();
  const [playMode, setPlayMode] = useState<PlayMode>('online');
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('medium');
  const [selectedColor, setSelectedColor] = useState<PieceColor | 'random'>('w');

  if (!user) return null;

  const handleStartComputerGame = () => {
    const color: PieceColor =
      selectedColor === 'random'
        ? (Math.random() > 0.5 ? 'w' : 'b')
        : selectedColor;
    computerGame.startGame(color, selectedDifficulty);
  };

  const timeControlGroups = [
    {
      label: 'Bullet',
      icon: '⚡',
      controls: [TIME_CONTROLS.BULLET_1!, TIME_CONTROLS.BULLET_2!],
    },
    {
      label: 'Blitz',
      icon: '🔥',
      controls: [TIME_CONTROLS.BLITZ_3!, TIME_CONTROLS.BLITZ_5!],
    },
    {
      label: 'Rapid',
      icon: '🕐',
      controls: [TIME_CONTROLS.RAPID_10!, TIME_CONTROLS.RAPID_15!],
    },
    {
      label: 'Classical',
      icon: '🏛️',
      controls: [TIME_CONTROLS.CLASSICAL_30!],
    },
  ];

  const difficulties: { id: Difficulty; label: string; emoji: string; desc: string }[] = [
    { id: 'easy', label: 'Easy', emoji: '🟢', desc: 'Random moves' },
    { id: 'medium', label: 'Medium', emoji: '🟡', desc: 'Tactical play' },
    { id: 'hard', label: 'Hard', emoji: '🔴', desc: 'Minimax AI' },
  ];

  const colorOptions: { id: PieceColor | 'random'; label: string; icon: string }[] = [
    { id: 'w', label: 'White', icon: '⬜' },
    { id: 'b', label: 'Black', icon: '⬛' },
    { id: 'random', label: 'Random', icon: '🎲' },
  ];

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary overflow-hidden flex flex-col font-sans pt-20">
      {/* Main Content Area */}
      <main className="flex-1 relative overflow-y-auto px-6 pb-12 pt-8">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-white/5 blur-[200px] rounded-full pointer-events-none -z-10" />
        
        <div className="max-w-4xl mx-auto flex flex-col items-center">
          {/* Play Mode Switcher */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full text-center mb-10"
          >
            <h2 className="text-5xl font-bold tracking-tight mb-6 text-white">
              {playMode === 'online' ? 'Play Online' : 'Play Computer'}
            </h2>
            <div className="inline-flex bg-white/5 border border-white/10 rounded-2xl p-1.5 gap-1">
              <button
                onClick={() => setPlayMode('online')}
                className={`relative flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                  playMode === 'online'
                    ? 'text-black'
                    : 'text-text-muted hover:text-white'
                }`}
              >
                <span className="relative z-10 flex items-center gap-2">
                  <Globe size={16} />
                  Play Online
                </span>
                {playMode === 'online' && (
                  <motion.div
                    layoutId="playModeIndicator"
                    className="absolute inset-0 bg-white rounded-xl z-0"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                  />
                )}
              </button>
              <button
                onClick={() => setPlayMode('computer')}
                className={`relative flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
                  playMode === 'computer'
                    ? 'text-black'
                    : 'text-text-muted hover:text-white'
                }`}
              >
                <span className="relative z-10 flex items-center gap-2">
                  <Monitor size={16} />
                  Play Computer
                </span>
                {playMode === 'computer' && (
                  <motion.div
                    layoutId="playModeIndicator"
                    className="absolute inset-0 bg-white rounded-xl z-0"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                  />
                )}
              </button>
            </div>
          </motion.div>

          <AnimatePresence mode="wait">
            {/* Online Mode */}
            {playMode === 'online' && (
              <motion.div
                key="online"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="w-full grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                {timeControlGroups.map((group, groupIdx) => (
                  <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: groupIdx * 0.1, duration: 0.5, ease: 'easeOut' }}
                    key={group.label} 
                    className="glass-card p-8 flex flex-col"
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <span className="text-3xl">{group.icon}</span>
                      <h3 className="text-2xl font-semibold text-white">{group.label}</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-auto">
                      {group.controls.map((tc) => (
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          key={tc.name}
                          onClick={() => findMatch(tc)}
                          disabled={phase !== 'idle'}
                          className="relative overflow-hidden bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col items-center justify-center gap-2 hover:bg-white/10 hover:border-white/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="text-3xl font-bold text-white">
                            {tc.name.split(' ')[1]}
                          </span>
                          <span className="text-sm text-text-muted font-medium tracking-wide uppercase">
                            {tc.name.split(' ')[0]}
                          </span>
                        </motion.button>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* Computer Mode */}
            {playMode === 'computer' && (
              <motion.div
                key="computer"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="w-full grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                {/* Difficulty Picker */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0, duration: 0.5, ease: 'easeOut' }}
                  className="glass-card p-8 flex flex-col"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <span className="text-3xl">🧠</span>
                    <h3 className="text-2xl font-semibold text-white">Difficulty</h3>
                  </div>
                  <div className="flex flex-col gap-3 mt-auto">
                    {difficulties.map((diff) => (
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        key={diff.id}
                        onClick={() => setSelectedDifficulty(diff.id)}
                        className={`relative overflow-hidden border rounded-2xl p-5 flex items-center gap-4 transition-all duration-300 ${
                          selectedDifficulty === diff.id
                            ? 'bg-white/10 border-white/30 shadow-[0_0_15px_rgba(255,255,255,0.08)]'
                            : 'bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/20'
                        }`}
                      >
                        <span className="text-2xl">{diff.emoji}</span>
                        <div className="text-left">
                          <p className="text-base font-semibold text-white">{diff.label}</p>
                          <p className="text-xs text-text-muted">{diff.desc}</p>
                        </div>
                        {selectedDifficulty === diff.id && (
                          <motion.div
                            layoutId="difficultyCheck"
                            className="ml-auto w-5 h-5 rounded-full bg-white flex items-center justify-center"
                            transition={{ type: 'spring', bounce: 0.3, duration: 0.5 }}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </motion.div>
                        )}
                      </motion.button>
                    ))}
                  </div>
                </motion.div>

                {/* Color Picker + Start */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1, duration: 0.5, ease: 'easeOut' }}
                  className="glass-card p-8 flex flex-col"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <span className="text-3xl">♟</span>
                    <h3 className="text-2xl font-semibold text-white">Play as</h3>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-8">
                    {colorOptions.map((opt) => (
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        key={opt.id}
                        onClick={() => setSelectedColor(opt.id)}
                        className={`relative overflow-hidden border rounded-2xl p-5 flex flex-col items-center justify-center gap-2 transition-all duration-300 ${
                          selectedColor === opt.id
                            ? 'bg-white/10 border-white/30 shadow-[0_0_15px_rgba(255,255,255,0.08)]'
                            : 'bg-white/5 border-white/10 hover:bg-white/8 hover:border-white/20'
                        }`}
                      >
                        <span className="text-3xl">{opt.icon}</span>
                        <span className="text-xs text-text-muted font-medium">{opt.label}</span>
                      </motion.button>
                    ))}
                  </div>

                  {/* Start Game Button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleStartComputerGame}
                    className="btn-primary w-full text-lg py-4 mt-auto"
                  >
                    🎮 Start Game
                  </motion.button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
