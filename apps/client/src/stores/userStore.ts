import { create } from 'zustand';
import { api } from '../services/api';
import type { GameHistoryEntry, User } from '@chess-arena/shared';

interface UserStore {
  history: GameHistoryEntry[];
  leaderboard: Partial<User>[];
  stats: User | null;
  isLoading: boolean;
  error: string | null;

  fetchHistory: () => Promise<void>;
  fetchLeaderboard: () => Promise<void>;
  fetchStats: () => Promise<void>;
}

export const useUserStore = create<UserStore>((set) => ({
  history: [],
  leaderboard: [],
  stats: null,
  isLoading: false,
  error: null,

  fetchHistory: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.get<{ games: GameHistoryEntry[] }>('/users/me/history');
      set({ history: data.games, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  fetchStats: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.get<User>('/users/me');
      set({ stats: data, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  fetchLeaderboard: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.get<{ players: Partial<User>[] }>('/users/leaderboard');
      set({ leaderboard: data.players, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },
}));
