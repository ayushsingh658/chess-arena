import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';
import { useGameStore } from '../../stores/gameStore';
import { TIME_CONTROLS } from '@chess-arena/shared';
import { ProfilePage } from '../Profile/ProfilePage';
import { LeaderboardPage } from '../Leaderboard/LeaderboardPage';
import { Play, User, Trophy, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type Tab = 'play' | 'profile' | 'leaderboard';

export function LobbyPage() {
  const { user, logout } = useAuthStore();
  const { findMatch, phase } = useGameStore();
  const [activeTab, setActiveTab] = useState<Tab>('play');

  if (!user) return null;

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

  const navItems = [
    { id: 'play', label: 'Play', icon: Play },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  ] as const;

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary overflow-hidden flex flex-col font-sans">
      {/* Translucent Floating Header */}
      <header className="sticky top-0 z-50 flex justify-center pt-6 px-6">
        <motion.div 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="flex items-center justify-between w-full max-w-5xl glass-card px-6 py-4"
        >
          {/* Logo */}
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-text-primary">
              Chess<span className="text-text-secondary">Arena</span>
            </h1>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`relative px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    isActive ? 'text-black' : 'text-text-muted hover:text-white'
                  }`}
                >
                  <span className="relative z-10 flex items-center gap-2">
                    <Icon size={16} />
                    {item.label}
                  </span>
                  {isActive && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className="absolute inset-0 bg-white rounded-full z-0"
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* User Profile & Logout */}
          <div className="flex items-center gap-4">
            <div className="flex flex-col text-right">
              <span className="text-sm font-medium">{user.username}</span>
              <span className="text-xs text-text-muted">Elo {user.eloRating}</span>
            </div>
            <button
              onClick={logout}
              className="p-2 rounded-full text-text-muted hover:text-white hover:bg-white/10 transition-colors"
            >
              <LogOut size={18} />
            </button>
          </div>
        </motion.div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-y-auto px-6 pb-12 pt-8">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-white/5 blur-[200px] rounded-full pointer-events-none -z-10" />
        
        <AnimatePresence mode="wait">
          {activeTab === 'play' && (
            <motion.div
              key="play"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-4xl mx-auto flex flex-col items-center"
            >
              <div className="w-full text-center mb-16">
                <h2 className="text-5xl font-bold tracking-tight mb-4">
                  Select Time Control
                </h2>
                <p className="text-text-muted text-lg">Join the matchmaking pool and challenge a player.</p>
              </div>

              {/* Bento Box Grid for Time Controls */}
              <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6">
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
                      <h3 className="text-2xl font-semibold">{group.label}</h3>
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
              </div>
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <ProfilePage />
            </motion.div>
          )}

          {activeTab === 'leaderboard' && (
            <motion.div
              key="leaderboard"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <LeaderboardPage />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
