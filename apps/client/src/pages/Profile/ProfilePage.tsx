import { useEffect, useState } from 'react';
import { api } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import type { GameResult } from '@chess-arena/shared';

interface GameHistoryEntry {
  id: string;
  whitePlayer: { id: string; username: string; eloRating: number };
  blackPlayer: { id: string; username: string; eloRating: number };
  result: GameResult;
  totalMoves: number;
  playedAt: string;
}

export function ProfilePage() {
  const { user } = useAuthStore();
  const [history, setHistory] = useState<GameHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await api.get('/users/me/history');
        setHistory(res.games);
      } catch (err) {
        console.error('Failed to fetch history', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchHistory();
  }, []);

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto px-8 py-12">
      <h2 className="text-3xl font-bold gradient-text mb-8">Profile & Match History</h2>
      
      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        <StatCard label="Current Elo" value={user.eloRating.toString()} icon="📊" />
        <StatCard label="Games Played" value={user.gamesPlayed.toString()} icon="♟" />
        <StatCard label="Wins" value={user.wins.toString()} icon="🏆" />
        <StatCard label="Win Rate" value={user.gamesPlayed > 0 ? `${Math.round((user.wins / user.gamesPlayed) * 100)}%` : '—'} icon="📈" />
      </div>

      <h3 className="text-xl font-bold text-text-primary mb-4">Recent Games</h3>
      
      {isLoading ? (
        <div className="text-text-muted">Loading history...</div>
      ) : history.length === 0 ? (
        <div className="glass-card p-8 text-center text-text-muted">
          No games played yet. Enter the arena!
        </div>
      ) : (
        <div className="space-y-3">
          {history.map(game => {
            const isWhite = game.whitePlayer.id === user.id;
            
            let resultText = 'Draw';
            let resultColor = 'text-text-muted';
            
            if (game.result === 'DRAW') {
              resultText = 'Draw';
            } else if ((game.result === 'WHITE_WINS' && isWhite) || (game.result === 'BLACK_WINS' && !isWhite)) {
              resultText = 'Victory';
              resultColor = 'text-success';
            } else if ((game.result === 'BLACK_WINS' && isWhite) || (game.result === 'WHITE_WINS' && !isWhite)) {
              resultText = 'Defeat';
              resultColor = 'text-danger';
            } else {
              // Resignation, timeout, etc.
              resultText = game.result;
            }

            return (
              <div key={game.id} className="glass-card p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                <div className="flex items-center gap-4">
                  <div className={`font-bold ${resultColor} w-20`}>{resultText}</div>
                  <div className="text-sm text-text-secondary">
                    {new Date(game.playedAt).toLocaleDateString()}
                  </div>
                </div>
                
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm bg-white border border-gray-400"></span>
                    <span className={isWhite ? 'font-bold text-text-primary' : 'text-text-muted'}>
                      {game.whitePlayer.username} ({game.whitePlayer.eloRating})
                    </span>
                  </div>
                  <span className="text-text-muted text-xs">vs</span>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm bg-gray-900 border border-gray-600"></span>
                    <span className={!isWhite ? 'font-bold text-text-primary' : 'text-text-muted'}>
                      {game.blackPlayer.username} ({game.blackPlayer.eloRating})
                    </span>
                  </div>
                </div>

                <div className="text-xs text-text-muted w-16 text-right">
                  {game.totalMoves} moves
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="glass-card p-5 text-center">
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-xl font-bold text-text-primary">{value}</div>
      <div className="text-xs text-text-muted mt-1">{label}</div>
    </div>
  );
}
