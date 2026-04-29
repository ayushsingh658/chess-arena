import { create } from 'zustand';
import { authApi, setAccessToken, ApiError } from '../services/api';
import { connectSocket, disconnectSocket } from '../services/socket';
import type { PublicProfile } from '@chess-arena/shared';

// ─────────────────────────────────────────────────────────
// Auth Store (Zustand)
// ─────────────────────────────────────────────────────────
// Global auth state accessible from any component.
// Manages user session, token persistence, and socket lifecycle.

interface AuthState {
  user: PublicProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  fieldErrors: Array<{ field: string; message: string }> | null;

  // Actions
  register: (username: string, email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginAsGuest: () => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true, // Start as loading to check for existing session
  error: null,
  fieldErrors: null,

  register: async (username, email, password) => {
    set({ isLoading: true, error: null, fieldErrors: null });
    try {
      const response = await authApi.register({ username, email, password });
      // Store token in localStorage for persistence across refreshes
      localStorage.setItem('accessToken', response.accessToken);
      // Connect WebSocket now that we're authenticated
      connectSocket();
      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      const apiError = err as ApiError;
      set({
        isLoading: false,
        error: apiError.message,
        fieldErrors: apiError.fields ?? null,
      });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true, error: null, fieldErrors: null });
    try {
      const response = await authApi.login({ email, password });
      localStorage.setItem('accessToken', response.accessToken);
      connectSocket();
      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      const apiError = err as ApiError;
      set({
        isLoading: false,
        error: apiError.message,
        fieldErrors: apiError.fields ?? null,
      });
    }
  },

  loginAsGuest: async () => {
    set({ isLoading: true, error: null, fieldErrors: null });
    try {
      const response = await authApi.loginAsGuest();
      localStorage.setItem('accessToken', response.accessToken);
      connectSocket();
      set({
        user: response.user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      const apiError = err as ApiError;
      set({
        isLoading: false,
        error: apiError.message,
        fieldErrors: apiError.fields ?? null,
      });
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // Logout should always succeed client-side
    }
    localStorage.removeItem('accessToken');
    disconnectSocket();
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
  },

  /**
   * Check if user has an existing session on app startup.
   * Tries to restore from localStorage token first,
   * then falls back to refresh token cookie.
   */
  checkAuth: async () => {
    const storedToken = localStorage.getItem('accessToken');

    if (!storedToken) {
      set({ isLoading: false });
      return;
    }

    // Restore the token in the API client
    setAccessToken(storedToken);

    try {
      const { user } = await authApi.getProfile();
      connectSocket();
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      // Token might be expired — try refreshing
      try {
        const { accessToken } = await authApi.refreshToken();
        localStorage.setItem('accessToken', accessToken);
        const { user } = await authApi.getProfile();
        connectSocket();
        set({
          user,
          isAuthenticated: true,
          isLoading: false,
        });
      } catch {
        // Both token and refresh failed — clear session
        localStorage.removeItem('accessToken');
        setAccessToken(null);
        set({ isLoading: false });
      }
    }
  },

  clearError: () => set({ error: null, fieldErrors: null }),
}));
