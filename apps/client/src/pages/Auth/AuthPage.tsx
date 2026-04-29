import { useState } from 'react';
import { useAuthStore } from '../../stores/authStore';

// ─────────────────────────────────────────────────────────
// Auth Page — Login & Register
// ─────────────────────────────────────────────────────────
// Single page with tab switching between login and register.
// Uses glassmorphism card design with smooth transitions.

export function AuthPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold gradient-text mb-2">♟ Chess Arena</h1>
          <p className="text-text-muted text-sm">
            {mode === 'login' ? 'Welcome back, player' : 'Join the arena'}
          </p>
        </div>

        {/* Card */}
        <div className="glass-card p-8">
          {/* Tab switcher */}
          <div className="flex mb-8 bg-bg-primary/50 rounded-lg p-1">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all duration-300 cursor-pointer ${
                mode === 'login'
                  ? 'bg-bg-elevated text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 py-2.5 text-sm font-medium rounded-md transition-all duration-300 cursor-pointer ${
                mode === 'register'
                  ? 'bg-bg-elevated text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              Sign Up
            </button>
          </div>

          {/* Forms */}
          {mode === 'login' ? <LoginForm /> : <RegisterForm />}

          {/* Guest Play */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <GuestLoginButton />
          </div>
        </div>
      </div>
    </div>
  );
}

function GuestLoginButton() {
  const { loginAsGuest, isLoading } = useAuthStore();

  return (
    <button
      onClick={() => loginAsGuest()}
      disabled={isLoading}
      className="btn-secondary w-full disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <Spinner /> Entering Arena...
        </span>
      ) : (
        'Play as Guest (Anonymous)'
      )}
    </button>
  );
}

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error, clearError } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    await login(email, password);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div>
        <label htmlFor="login-email" className="block text-sm text-text-secondary mb-2">
          Email
        </label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-field"
          placeholder="player@chess.com"
          required
          autoComplete="email"
        />
      </div>

      <div>
        <label htmlFor="login-password" className="block text-sm text-text-secondary mb-2">
          Password
        </label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input-field"
          placeholder="••••••••"
          required
          autoComplete="current-password"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <Spinner /> Signing in...
          </span>
        ) : (
          'Sign In'
        )}
      </button>
    </form>
  );
}

function RegisterForm() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const { register, isLoading, error, fieldErrors, clearError } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError(null);

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    await register(username, email, password);
  };

  const displayError = localError || error;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {displayError && (
        <div className="bg-danger/10 border border-danger/30 text-danger rounded-lg px-4 py-3 text-sm">
          {displayError}
        </div>
      )}

      <div>
        <label htmlFor="reg-username" className="block text-sm text-text-secondary mb-2">
          Username
        </label>
        <input
          id="reg-username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className={`input-field ${getFieldError('username', fieldErrors) ? 'border-danger' : ''}`}
          placeholder="grandmaster42"
          required
          minLength={3}
          maxLength={20}
          autoComplete="username"
        />
        {getFieldError('username', fieldErrors) && (
          <p className="text-danger text-xs mt-1">{getFieldError('username', fieldErrors)}</p>
        )}
      </div>

      <div>
        <label htmlFor="reg-email" className="block text-sm text-text-secondary mb-2">
          Email
        </label>
        <input
          id="reg-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={`input-field ${getFieldError('email', fieldErrors) ? 'border-danger' : ''}`}
          placeholder="player@chess.com"
          required
          autoComplete="email"
        />
        {getFieldError('email', fieldErrors) && (
          <p className="text-danger text-xs mt-1">{getFieldError('email', fieldErrors)}</p>
        )}
      </div>

      <div>
        <label htmlFor="reg-password" className="block text-sm text-text-secondary mb-2">
          Password
        </label>
        <input
          id="reg-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={`input-field ${getFieldError('password', fieldErrors) ? 'border-danger' : ''}`}
          placeholder="••••••••"
          required
          minLength={8}
          autoComplete="new-password"
        />
        {getFieldError('password', fieldErrors) && (
          <p className="text-danger text-xs mt-1">{getFieldError('password', fieldErrors)}</p>
        )}
        <p className="text-text-muted text-xs mt-1">
          Min 8 chars, with uppercase, lowercase, and number
        </p>
      </div>

      <div>
        <label htmlFor="reg-confirm-password" className="block text-sm text-text-secondary mb-2">
          Confirm Password
        </label>
        <input
          id="reg-confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="input-field"
          placeholder="••••••••"
          required
          autoComplete="new-password"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <Spinner /> Creating account...
          </span>
        ) : (
          'Create Account'
        )}
      </button>
    </form>
  );
}

/** Loading spinner component */
function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-25"
        cx="12" cy="12" r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

/** Helper to extract a field error by name */
function getFieldError(
  field: string,
  errors: Array<{ field: string; message: string }> | null
): string | undefined {
  return errors?.find((e) => e.field === field)?.message;
}
