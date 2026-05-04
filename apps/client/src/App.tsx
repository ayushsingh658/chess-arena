import { useEffect } from 'react';
import { useAuthStore } from './stores/authStore';
import { useGameStore } from './stores/gameStore';
import { useComputerGameStore } from './stores/computerGameStore';
import { AuthPage } from './pages/Auth/AuthPage';
import { LobbyPage } from './pages/Lobby/LobbyPage';
import { GamePage } from './pages/Game/GamePage';
import { ComputerGamePage } from './pages/Game/ComputerGamePage';
import { ReviewPage } from './pages/Game/ReviewPage';
import { LeaderboardPage } from './pages/Leaderboard/LeaderboardPage';
import { SpectatePage } from './pages/Spectate/SpectatePage';
import { SearchingOverlay } from './components/Game/GameComponents';
import { useReviewStore } from './stores/reviewStore';
import { Toaster } from 'react-hot-toast';
import { Navbar } from './components/Navigation/Navbar';
import { ProfilePage } from './pages/Profile/ProfilePage';
import { useState } from 'react';
import './index.css';

// ─────────────────────────────────────────────────────────
// App Root — Phase-Based Routing
// ─────────────────────────────────────────────────────────
// Route based on both auth state and game phase:
//   Not authenticated → Auth page
//   Idle              → Lobby (pick time control or play computer)
//   Searching         → Lobby + search overlay
//   Playing/GameOver  → Game page (multiplayer or computer)

function App() {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const { phase, initSocketListeners, cleanupSocketListeners } = useGameStore();
  const computerPhase = useComputerGameStore((s) => s.phase);
  const isReviewing = useReviewStore((s) => s.pgn !== '');
  const resetReview = useReviewStore((s) => s.resetReview);
  
  const [view, setView] = useState<'lobby' | 'profile' | 'leaderboard' | 'watch'>('lobby');

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

  if (isReviewing) {
    return <ReviewPage onExit={resetReview} />;
  }

  // Computer game takes priority (it's local, no socket needed)
  if (computerPhase === 'playing' || computerPhase === 'gameOver') {
    return <ComputerGamePage />;
  }

  // Multiplayer phase-based rendering
  if (phase === 'playing' || phase === 'gameOver') {
    return <GamePage />;
  }

  return (
    <div className="min-h-screen bg-bg-primary relative overflow-x-hidden">
      {/* Global Background Grid */}
      <div className="fixed inset-0 bg-grid-white pointer-events-none z-0" />
      
      <Toaster 
        position="top-center" 
        toastOptions={{
          style: {
            background: 'rgba(18, 18, 18, 0.8)',
            backdropFilter: 'blur(12px)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '16px',
            padding: '16px',
          },
        }} 
      />
      <div className="relative z-10">
        <Navbar currentView={view} onViewChange={setView} />
        {view === 'lobby' ? <LobbyPage /> : view === 'profile' ? <ProfilePage /> : view === 'leaderboard' ? <LeaderboardPage /> : <SpectatePage />}
        {phase === 'searching' && <SearchingOverlay />}
      </div>
    </div>
  );
}

export default App;

