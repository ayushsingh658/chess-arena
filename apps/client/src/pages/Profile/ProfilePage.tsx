import { useEffect } from 'react';
import { useUserStore } from '../../stores/userStore';
import { useAuthStore } from '../../stores/authStore';
import { Trophy, Target, Activity, Award, Clock, Shield } from 'lucide-react';
import { motion } from 'framer-motion';

export function ProfilePage() {
  const { stats, history, fetchStats, fetchHistory, isLoading } = useUserStore();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    fetchStats();
    fetchHistory();
  }, [fetchStats, fetchHistory]);

  if (isLoading || !stats) {
    return (
      <div className="flex flex-col items-center justify-center py-40 gap-6">
        <div className="w-12 h-12 border-2 border-white/10 border-t-white rounded-full animate-spin" />
        <span className="text-text-muted text-xs font-bold tracking-[0.2em] uppercase">Syncing Profile...</span>
      </div>
    );
  }

  const winRate = stats.gamesPlayed > 0 
    ? Math.round((stats.wins / stats.gamesPlayed) * 100) 
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-8 pt-32 pb-20">
      {/* Profile Header */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative mb-16"
      >
        <div className="flex flex-col md:flex-row items-center md:items-end gap-10">
          <div className="relative group">
            <div className="w-40 h-40 rounded-[40px] bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center text-6xl shadow-2xl border border-white/10 group-hover:scale-105 transition-transform duration-700">
              ♟️
            </div>
            <div className="absolute -bottom-2 -right-2 w-12 h-12 rounded-2xl bg-white text-black flex items-center justify-center shadow-2xl border-4 border-bg-primary">
              <Shield size={20} />
            </div>
          </div>
          
          <div className="flex-1 text-center md:text-left pb-2">
            <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
              <h2 className="text-7xl font-bold tracking-tighter text-gradient">{user?.username}</h2>
              <div className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-bold tracking-widest uppercase text-text-muted">
                Arena Member
              </div>
            </div>
            <p className="text-text-secondary text-lg max-w-2xl font-medium">
              A strategic mind specialized in classical openings and high-speed tactics. 
              Currently honing skills on the Arena boards.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-16">
        <StatCard 
          icon={<Trophy className="text-white" size={24} />} 
          label="Rating" 
          value={stats.eloRating} 
          sub="Global Ranking Active"
          delay={0.1}
        />
        <StatCard 
          icon={<Target className="text-white" size={24} />} 
          label="Games" 
          value={stats.gamesPlayed} 
          sub={`${stats.wins}W / ${stats.losses}L`}
          delay={0.2}
        />
        <StatCard 
          icon={<Activity className="text-white" size={24} />} 
          label="Win Rate" 
          value={`${winRate}%`} 
          sub="Career Average"
          delay={0.3}
        />
        <StatCard 
          icon={<Award className="text-white" size={24} />} 
          label="Level" 
          value={Math.floor(stats.gamesPlayed / 5) + 1} 
          sub="Progress Tracking"
          delay={0.4}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Match History Table */}
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="lg:col-span-2 glass-card overflow-hidden border-none"
        >
          <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Clock size={20} className="text-text-muted" />
              Battle History
            </h3>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.02]">
                  <th className="px-8 py-4 text-[10px] font-bold text-text-muted uppercase tracking-[0.2em]">Opponent</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-text-muted uppercase tracking-[0.2em]">Result</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-text-muted uppercase tracking-[0.2em]">Rating</th>
                  <th className="px-8 py-4 text-[10px] font-bold text-text-muted uppercase tracking-[0.2em] text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {history.map((match, idx) => {
                  const isWhite = match.whitePlayer.id === user?.id;
                  const opponent = isWhite ? match.blackPlayer : match.whitePlayer;
                  const result = match.result;
                  
                  let outcome: 'win' | 'loss' | 'draw' = 'draw';
                  if (result === 'WHITE_WINS') outcome = isWhite ? 'win' : 'loss';
                  else if (result === 'BLACK_WINS') outcome = isWhite ? 'loss' : 'win';
                  else if (result === 'DRAW') outcome = 'draw';
                  // Handle other results as losses for simplicity or refine as needed
                  else outcome = 'loss';

                  return (
                    <motion.tr 
                      key={match.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.6 + (idx * 0.05) }}
                      className="group hover:bg-white/[0.02] transition-colors cursor-pointer"
                    >
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-xs font-bold text-white border border-white/10 group-hover:bg-white group-hover:text-black transition-all">
                            {opponent.username.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">{opponent.username}</p>
                            <p className="text-[10px] text-text-muted uppercase tracking-wider font-medium">{match.totalMoves} Moves</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <span className={`text-xs font-bold tracking-widest uppercase ${
                          outcome === 'win' ? 'text-white' : 
                          outcome === 'loss' ? 'text-text-muted opacity-50' : 'text-text-secondary'
                        }`}>
                          {outcome === 'win' ? 'Victory' : outcome === 'loss' ? 'Defeat' : 'Draw'}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-bold text-white">
                            {isWhite ? match.whitePlayer.eloRating : match.blackPlayer.eloRating}
                          </span>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-right text-xs font-bold text-text-muted tabular-nums">
                        {new Date(match.playedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </td>
                    </motion.tr>
                  );
                })}
                {history.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-8 py-20 text-center text-text-muted text-sm italic">
                      No matches recorded yet. Enter the Arena to start your legacy.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Side Panel */}
        <div className="flex flex-col gap-6">
          <motion.div 
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="glass-card p-8"
          >
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <Award size={20} className="text-text-muted" />
              Arena Status
            </h3>
            <div className="space-y-4">
              <AchievementItem title="First Blood" desc="Win your first multiplayer game" progress={history.some(m => {
                const isWhite = m.whitePlayer.id === user?.id;
                return (isWhite && m.result === 'WHITE_WINS') || (!isWhite && m.result === 'BLACK_WINS');
              }) ? 100 : 0} completed={history.some(m => {
                const isWhite = m.whitePlayer.id === user?.id;
                return (isWhite && m.result === 'WHITE_WINS') || (!isWhite && m.result === 'BLACK_WINS');
              })} />
              <AchievementItem title="Veteran" desc="Play 50 games in the Arena" progress={Math.min(100, (stats.gamesPlayed / 50) * 100)} completed={stats.gamesPlayed >= 50} />
              <AchievementItem title="Rating 1500" desc="Reach 1500 Elo Rating" progress={Math.min(100, (stats.eloRating / 1500) * 100)} completed={stats.eloRating >= 1500} />
            </div>
          </motion.div>

          <motion.div 
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="glass-card p-8 bg-white text-black"
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1">Membership</p>
                <h3 className="text-2xl font-bold tracking-tight">Arena Plus</h3>
              </div>
              <Shield size={32} />
            </div>
            <p className="text-sm font-medium mb-8 opacity-70">
              Advanced analytics and premium themes enabled for your account.
            </p>
            <button className="w-full py-3 bg-black text-white rounded-xl text-sm font-bold hover:opacity-90 transition-opacity">
              Settings
            </button>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, delay }: { icon: React.ReactNode; label: string; value: string | number; sub: string; delay: number }) {
  return (
    <motion.div 
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay }}
      className="glass-card p-8 hover:bg-white/[0.02] transition-all duration-500 group"
    >
      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-6 border border-white/5 group-hover:bg-white group-hover:text-black transition-all duration-500">
        {icon}
      </div>
      <p className="text-xs font-bold text-text-muted uppercase tracking-[0.2em] mb-1">{label}</p>
      <h4 className="text-4xl font-bold text-white mb-2 tabular-nums tracking-tight">{value}</h4>
      <p className="text-[11px] text-text-muted font-medium uppercase tracking-wider">{sub}</p>
    </motion.div>
  );
}

function AchievementItem({ title, desc, progress, completed }: { title: string; desc: string; progress: number; completed?: boolean }) {
  return (
    <div className="group cursor-pointer">
      <div className="flex justify-between items-end mb-2">
        <div>
          <p className={`text-sm font-bold ${completed ? 'text-white' : 'text-text-secondary'}`}>{title}</p>
          <p className="text-[10px] text-text-muted font-medium">{desc}</p>
        </div>
        <span className="text-[10px] font-bold text-text-muted tabular-nums">{Math.round(progress)}%</span>
      </div>
      <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          whileInView={{ width: `${progress}%` }}
          transition={{ duration: 1.5, ease: 'circOut' }}
          className={`h-full ${completed ? 'bg-white' : 'bg-white/20'}`} 
        />
      </div>
    </div>
  );
}
