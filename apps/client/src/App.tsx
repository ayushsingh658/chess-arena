import { useEffect } from 'react';
import { useAuthStore } from './stores/authStore';
import { useGameStore } from './stores/gameStore';
import { AuthPage } from './pages/Auth/AuthPage';
import { LobbyPage } from './pages/Lobby/LobbyPage';
import { GamePage } from './pages/Game/GamePage';
import { SearchingOverlay } from './components/Game/GameComponents';
import './index.css';

// ─────────────────────────────────────────────────────────
// App Root — Phase-Based Routing
// ─────────────────────────────────────────────────────────
// Route based on both auth state and game phase:
//   Not authenticated → Auth page
//   Idle              → Lobby (pick time control)
//   Searching         → Lobby + search overlay
//   Playing/GameOver  → Game page

function App() {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const { phase, initSocketListeners, cleanupSocketListeners } = useGameStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Initialize socket listeners once authenticated
  useEffect(() => {
    if (isAuthenticated) {
      // Small delay to ensure socket is connected
      const timer = setTimeout(() => {
        initSocketListeners();
      }, 500);
      return () => {
        clearTimeout(timer);
        cleanupSocketListeners();
      };
    }
  }, [isAuthenticated, initSocketListeners, cleanupSocketListeners]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold gradient-text mb-4">♟ Chess Arena</h1>
          <div className="flex items-center justify-center gap-2 text-text-muted">
            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading...
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthPage />;
  }

  // Phase-based rendering
  if (phase === 'playing' || phase === 'gameOver') {
    return <GamePage />;
  }

  return (
    <>
      <LobbyPage />
      {phase === 'searching' && <SearchingOverlay />}
    </>
  );
}

export default App;
