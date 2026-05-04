// ─────────────────────────────────────────────────────────
// Sound Service
// ─────────────────────────────────────────────────────────
// Handles all game audio effects with volume control and 
// pre-loading. Uses premium, high-quality cinematic assets.

class SoundService {
  private sounds: Record<string, HTMLAudioElement> = {};
  private volume: number = 0.5;

  constructor() {
    // High-fidelity minimalist sounds
    const soundUrls = {
      // Game Actions
      move: 'https://images.chesscomfiles.com/chess-themes/sounds/_standard/default/move-self.mp3',
      capture: 'https://images.chesscomfiles.com/chess-themes/sounds/_standard/default/capture.mp3',
      check: 'https://images.chesscomfiles.com/chess-themes/sounds/_standard/default/move-check.mp3',
      castle: 'https://images.chesscomfiles.com/chess-themes/sounds/_standard/default/castle.mp3',
      gameEnd: 'https://images.chesscomfiles.com/chess-themes/sounds/_standard/default/game-end.mp3',
      notify: 'https://images.chesscomfiles.com/chess-themes/sounds/_standard/default/premove.mp3',
      
      // UI Interactions (Premium UI Clicks)
      uiHover: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
      uiClick: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
      uiSuccess: 'https://assets.mixkit.co/active_storage/sfx/2567/2567-preview.mp3',
    };

    if (typeof window !== 'undefined') {
      Object.entries(soundUrls).forEach(([name, url]) => {
        const audio = new Audio(url);
        audio.preload = 'auto';
        this.sounds[name] = audio;
      });
    }
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  play(name: string) {
    const sound = this.sounds[name];
    if (sound) {
      const playInstance = sound.cloneNode() as HTMLAudioElement;
      playInstance.volume = this.volume;
      playInstance.play().catch(e => {
        // Silently fail if user hasn't interacted with DOM yet
        if (e.name !== 'NotAllowedError') {
          console.warn('[SoundService] Playback failed:', e);
        }
      });
    }
  }
}

export const soundService = new SoundService();
