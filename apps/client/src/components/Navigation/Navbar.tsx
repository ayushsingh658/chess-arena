import { useAuthStore } from '../../stores/authStore';
import { motion } from 'framer-motion';
import { User, LogOut, LayoutDashboard, Trophy, MonitorPlay } from 'lucide-react';

interface NavbarProps {
  currentView: 'lobby' | 'profile' | 'leaderboard' | 'watch';
  onViewChange: (view: 'lobby' | 'profile' | 'leaderboard' | 'watch') => void;
}

export function Navbar({ currentView, onViewChange }: NavbarProps) {
  const { user, logout } = useAuthStore();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 px-8 py-6">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <motion.div 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => onViewChange('lobby')}
        >
          <div className="w-11 h-11 rounded-2xl bg-white flex items-center justify-center text-2xl shadow-2xl group-hover:scale-105 transition-transform duration-500">
            ♟️
          </div>
          <span className="text-2xl font-bold tracking-tighter text-white">
            Chess<span className="text-text-secondary font-medium">Arena</span>
          </span>
        </motion.div>

        {/* Navigation Items (The "Pill") */}
        <motion.div 
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="hidden lg:flex items-center bg-white/[0.03] backdrop-blur-3xl border border-white/5 rounded-full p-1.5 shadow-2xl"
        >
          <NavItem 
            active={currentView === 'lobby'} 
            onClick={() => onViewChange('lobby')}
            icon={<LayoutDashboard size={18} />}
            label="Play"
          />
          <NavItem 
            active={currentView === 'watch'} 
            onClick={() => onViewChange('watch')}
            icon={<MonitorPlay size={18} />}
            label="Watch"
          />
          <NavItem 
            active={currentView === 'profile'} 
            onClick={() => onViewChange('profile')}
            icon={<User size={18} />}
            label="Profile"
          />
          <NavItem 
            active={currentView === 'leaderboard'} 
            onClick={() => onViewChange('leaderboard')}
            icon={<Trophy size={18} />}
            label="Leaderboard"
          />
        </motion.div>

        {/* User Actions */}
        <motion.div 
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="flex items-center gap-6"
        >
          <div 
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => onViewChange('profile')}
          >
            <div className="text-right hidden sm:block">
              <div className="text-sm font-bold text-white leading-tight group-hover:text-white transition-colors">{user?.username}</div>
              <div className="text-[10px] text-text-muted font-bold tracking-[0.2em] uppercase">Rating {user?.eloRating}</div>
            </div>
            <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white group-hover:bg-white group-hover:text-black transition-all duration-500 overflow-hidden">
              <User size={20} />
            </div>
          </div>
          
          <button 
            onClick={() => logout()}
            className="w-10 h-10 rounded-full flex items-center justify-center text-text-muted hover:text-white hover:bg-white/5 transition-all duration-300"
            title="Logout"
          >
            <LogOut size={20} />
          </button>
        </motion.div>
      </div>
    </nav>
  );
}

function NavItem({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button 
      onClick={onClick}
      className={`relative px-6 py-2.5 rounded-full text-sm font-bold transition-all duration-500 flex items-center gap-2 overflow-hidden ${
        active ? 'text-black' : 'text-text-muted hover:text-white'
      }`}
    >
      <span className="relative z-10 flex items-center gap-2">
        {icon}
        {label}
      </span>
      {active && (
        <motion.div 
          layoutId="nav-pill"
          className="absolute inset-0 bg-white"
          transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
        />
      )}
    </button>
  );
}
