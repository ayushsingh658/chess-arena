import { useEffect, useState } from 'react';
import { api } from '../../services/api';

interface LeaderboardPlayer {
  id: string;
  username: string;
  eloRating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
}

export function LeaderboardPage() {
  const [players, setPlayers] = useState<LeaderboardPlayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await api.get('/users/leaderboard');
        setPlayers(res.players);
      } catch (err) {
        console.error('Failed to fetch leaderboard', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-8 py-12">
      <h2 className="text-3xl font-bold gradient-text mb-2">Global Leaderboard</h2>
      <p className="text-text-muted mb-8">Top 50 highest rated players in the arena.</p>
      
      {isLoading ? (
        <div className="text-text-muted">Loading leaderboard...</div>
      ) : players.length === 0 ? (
        <div className="glass-card p-8 text-center text-text-muted">
          No players found.
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10">
                <th className="p-4 font-semibold text-text-secondary w-16 text-center">Rank</th>
                <th className="p-4 font-semibold text-text-secondary">Player</th>
                <th className="p-4 font-semibold text-text-secondary">Rating</th>
                <th className="p-4 font-semibold text-text-secondary text-center">W / D / L</th>
                <th className="p-4 font-semibold text-text-secondary text-right">Win Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {players.map((player, index) => {
                const winRate = player.gamesPlayed > 0 
                  ? Math.round((player.wins / player.gamesPlayed) * 100) 
                  : 0;

                return (
                  <tr key={player.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-4 text-center">
                      {index === 0 && <span className="text-xl">🥇</span>}
                      {index === 1 && <span className="text-xl">🥈</span>}
                      {index === 2 && <span className="text-xl">🥉</span>}
                      {index > 2 && <span className="text-text-muted font-mono">{index + 1}</span>}
                    </td>
                    <td className="p-4 font-medium text-text-primary">
                      {player.username}
                    </td>
                    <td className="p-4 font-bold text-accent-cyan">
                      {player.eloRating}
                    </td>
                    <td className="p-4 text-center text-sm text-text-muted">
                      <span className="text-success">{player.wins}</span> / <span>{player.draws}</span> / <span className="text-danger">{player.losses}</span>
                    </td>
                    <td className="p-4 text-right text-text-secondary">
                      {winRate}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
