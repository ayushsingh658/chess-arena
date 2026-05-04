import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '../../stores/gameStore';
import { api } from '../../services/api';
import { MonitorPlay, Users, Trophy, ExternalLink } from 'lucide-react';

interface LiveGame {
  gameId: string;
  whitePlayer: { username: string; eloRating: number };
  blackPlayer: { username: string; eloRating: number };
  moveCount: number;
  timeControl: number;
}

export function SpectatePage() {
  const [games, setGames] = useState<LiveGame[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const spectateGame = useGameStore((s) => s.spectateGame);

  const fetchLiveGames = async () => {
    try {
      const response = await api.get<{ games: LiveGame[] }>('/games/live');
      setGames(response.games);
    } catch (err) {
      console.error('Failed to fetch live games', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveGames();
    const interval = setInterval(fetchLiveGames, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-8 pt-32 pb-20">
      <div className="flex items-center justify-between mb-12">
        <motion.div 
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
        >
          <div className="flex items-center gap-3 text-text-muted mb-2">
            <MonitorPlay size={18} />
            <span className="text-xs font-bold tracking-[0.2em] uppercase">Arena Spectate</span>
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">Watch Live Games</h1>
        </motion.div>

        <motion.div 
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          className="flex items-center gap-6 bg-white/[0.03] backdrop-blur-xl border border-white/5 rounded-2xl px-6 py-3"
        >
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-text-muted font-bold tracking-widest uppercase mb-1">Active Matches</span>
            <span className="text-2xl font-bold text-white leading-none">{games.length}</span>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="flex flex-col items-center">
            <span className="text-[10px] text-text-muted font-bold tracking-widest uppercase mb-1">Live Viewers</span>
            <span className="text-2xl font-bold text-white leading-none">--</span>
          </div>
        </motion.div>
      </div>

      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div 
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 rounded-3xl bg-white/[0.02] border border-white/5 animate-pulse" />
            ))}
          </motion.div>
        ) : games.length === 0 ? (
          <motion.div 
            key="empty"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-center py-32 bg-white/[0.02] border border-white/5 rounded-[40px] backdrop-blur-sm"
          >
            <div className="w-20 h-20 rounded-3xl bg-white/5 flex items-center justify-center mx-auto mb-6 text-text-muted">
              <MonitorPlay size={40} />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">No Active Games</h2>
            <p className="text-text-muted">High-Elo matches will appear here once they start.</p>
          </motion.div>
        ) : (
          <motion.div 
            key="grid"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {games.map((game, index) => (
              <GameCard 
                key={game.gameId} 
                game={game} 
                index={index}
                onWatch={() => spectateGame(game.gameId, game.whitePlayer, game.blackPlayer)}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GameCard({ game, index, onWatch }: { game: LiveGame; index: number; onWatch: () => void }) {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: index * 0.05 }}
      whileHover={{ y: -8 }}
      className="group bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur-xl border border-white/5 rounded-[32px] p-8 transition-all duration-500 cursor-pointer overflow-hidden relative"
      onClick={onWatch}
    >
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 blur-[60px] rounded-full group-hover:bg-white/10 transition-colors duration-500" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div className="px-3 py-1 rounded-full bg-white/10 border border-white/10 text-[10px] font-bold text-white uppercase tracking-widest">
            {Math.floor(game.timeControl / 60)}m Blitz
          </div>
          <div className="flex items-center gap-1.5 text-text-muted">
            <Users size={14} />
            <span className="text-[10px] font-bold uppercase tracking-wider">-- watching</span>
          </div>
        </div>

        <div className="space-y-6 mb-8">
          <PlayerRow name={game.whitePlayer.username} rating={game.whitePlayer.eloRating} color="white" />
          <div className="flex items-center gap-4 px-4">
            <div className="h-px flex-1 bg-white/5" />
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">vs</span>
            <div className="h-px flex-1 bg-white/5" />
          </div>
          <PlayerRow name={game.blackPlayer.username} rating={game.blackPlayer.eloRating} color="black" />
        </div>

        <div className="flex items-center justify-between pt-6 border-t border-white/5">
          <div className="flex flex-col">
            <span className="text-[10px] text-text-muted font-bold tracking-widest uppercase mb-0.5">Progress</span>
            <span className="text-sm font-bold text-white">{game.moveCount} moves</span>
          </div>
          <button className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center scale-90 group-hover:scale-100 transition-transform duration-500 shadow-2xl shadow-white/20">
            <ExternalLink size={18} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function PlayerRow({ name, rating, color }: { name: string; rating: number; color: 'white' | 'black' }) {
  return (
    <div className="flex items-center gap-4">
      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xl shadow-inner ${
        color === 'white' ? 'bg-white text-black' : 'bg-black text-white border border-white/10'
      }`}>
        {color === 'white' ? '♔' : '♚'}
      </div>
      <div>
        <div className="text-lg font-bold text-white leading-tight">{name}</div>
        <div className="flex items-center gap-2">
          <Trophy size={10} className="text-text-muted" />
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{rating} Elo</span>
        </div>
      </div>
    </div>
  );
}
