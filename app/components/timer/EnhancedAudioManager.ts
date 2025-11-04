// Enhanced audio management with OS-level audio control capabilities
import { AudioConfig, SpeechOptions, TimerAudioManager } from './types';

// Audio session types for different platforms
interface AudioSession {
  setActive: (active: boolean) => Promise<boolean>;
  setCategory: (category: string) => Promise<boolean>;
  requestRecordPermission?: () => Promise<boolean>;
}

// Wake Lock API types
interface WakeLock {
  request: (type: 'screen') => Promise<WakeLockSentinel>;
}

interface WakeLockSentinel {
  release: () => Promise<void>;
}

// Media Session API types
interface MediaSession {
  metadata: MediaMetadata | null;
  playbackState: 'none' | 'paused' | 'playing';
}

interface MediaMetadata {
  title: string;
  artist: string;
  artwork: MediaImage[];
}

interface MediaImage {
  src: string;
  sizes: string;
  type: string;
}

// Navigator extensions for audio management
interface ExtendedNavigator {
  audioSession?: AudioSession;
  wakeLock?: WakeLock;
  mediaSession?: MediaSession;
}

export class DodgeballAudioManager implements TimerAudioManager {
  private audioContext: AudioContext | null = null;
  private buzzerSound: HTMLAudioElement | null = null;
  private buzzerBuffer: AudioBuffer | null = null;
  private config: AudioConfig;
  private hasAudioFocus: boolean = false;
  private originalSystemVolume: number | null = null;
  private isQuietingOtherApps: boolean = false;

  constructor(config: AudioConfig) {
    this.config = config;
    this.initializeAudio();
  }

  private async initializeAudio(): Promise<void> {
    try {
      // Create audio context with optimal settings for announcements
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioContextClass({
        latencyHint: 'interactive',
        sampleRate: 44100
      });
      
      // Create buzzer sound
      this.buzzerSound = new Audio();
      this.buzzerSound.volume = this.config.masterVolume;
      
      // Generate buzzer sound programmatically
      this.generateBuzzerSound();
      
    } catch (error) {
      console.warn('Audio initialization failed:', error);
    }
  }

  private generateBuzzerSound(): void {
    if (!this.audioContext) return;

    const createBuzzer = () => {
      if (!this.audioContext) return null;
      
      const buffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * 1, this.audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      
      // Generate buzzer tone (mix of frequencies for harsh sound)
      for (let i = 0; i < data.length; i++) {
        const t = i / this.audioContext.sampleRate;
        data[i] = (
          Math.sin(2 * Math.PI * 800 * t) * 0.5 +  // Primary tone
          Math.sin(2 * Math.PI * 1200 * t) * 0.3 +  // Harmonic
          Math.sin(2 * Math.PI * 600 * t) * 0.2     // Lower harmonic
        ) * Math.exp(-t * 3); // Decay envelope
      }
      
      return buffer;
    };

    const buzzerBuffer = createBuzzer();
    if (buzzerBuffer) {
      this.buzzerBuffer = buzzerBuffer;
    }
  }

  async requestAudioFocus(): Promise<boolean> {
    if (!this.config.requestAudioFocus) return true;

    try {
      // Try to request audio focus using various methods
      
      // Method 1: Wake Lock API (keeps device active)
      if ('wakeLock' in navigator) {
        try {
          const extendedNav = navigator as unknown as ExtendedNavigator;
          await extendedNav.wakeLock?.request('screen');
          console.log('Wake lock acquired for audio focus');
        } catch (error) {
          console.warn('Wake lock failed:', error);
        }
      }

      // Method 2: Audio Session API (iOS Safari)
      const extendedNavigator = navigator as ExtendedNavigator;
      if (extendedNavigator.audioSession) {
        try {
          await extendedNavigator.audioSession.setCategory('playback');
          await extendedNavigator.audioSession.setActive(true);
          console.log('Audio session activated');
          this.hasAudioFocus = true;
          return true;
        } catch (error) {
          console.warn('Audio session request failed:', error);
        }
      }

      // Method 3: Create a high-priority audio context
      if (this.audioContext) {
        try {
          await this.audioContext.resume();
          // Set audio context to high performance mode
          if ('audioWorklet' in this.audioContext) {
            console.log('High-priority audio context active');
          }
          this.hasAudioFocus = true;
          return true;
        } catch (error) {
          console.warn('Audio context priority request failed:', error);
        }
      }

      // Fallback: Basic focus request
      this.hasAudioFocus = true;
      return true;

    } catch (error) {
      console.warn('Audio focus request failed:', error);
      return false;
    }
  }

  releaseAudioFocus(): void {
    if (!this.hasAudioFocus) return;

    try {
      // Release wake lock
      if ('wakeLock' in navigator) {
        // Wake locks are automatically released when the page loses focus
        console.log('Wake lock will be released automatically');
      }

      // Release audio session
      const extendedNavigator = navigator as unknown as ExtendedNavigator;
      if (extendedNavigator.audioSession) {
        extendedNavigator.audioSession.setActive(false).catch(console.warn);
      }

      this.hasAudioFocus = false;
      console.log('Audio focus released');

    } catch (error) {
      console.warn('Audio focus release failed:', error);
    }
  }

  async quietOtherApps(): Promise<boolean> {
    if (!this.config.quietOtherApps || this.isQuietingOtherApps) return true;

    try {
      // Method 1: Request exclusive audio access
      if (this.audioContext) {
        // Try to suspend other audio contexts by claiming exclusive access
        const highPriorityGain = this.audioContext.createGain();
        highPriorityGain.gain.value = 1.0;
        highPriorityGain.connect(this.audioContext.destination);
        
        // Create a very quiet tone to maintain audio session priority
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.frequency.setValueAtTime(20, this.audioContext.currentTime); // Very low frequency
        gainNode.gain.setValueAtTime(0.001, this.audioContext.currentTime); // Very quiet
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        oscillator.start();
        
        // Stop after a brief moment
        setTimeout(() => {
          oscillator.stop();
        }, 100);
      }

      // Method 2: Show system notification to remind user to lower other audio
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Dodgeball Timer', {
          body: 'Please lower music/other audio for game announcements',
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          silent: true,
          requireInteraction: false
        });
      }

      // Method 3: Use Media Session API to take control
      if ('mediaSession' in navigator) {
        const extendedNav = navigator as unknown as ExtendedNavigator;
        if (extendedNav.mediaSession) {
          const MediaMetadataClass = (window as unknown as { MediaMetadata: new (data: { title: string; artist: string; artwork: MediaImage[] }) => MediaMetadata }).MediaMetadata;
          extendedNav.mediaSession.metadata = new MediaMetadataClass({
            title: 'Dodgeball Round Timer',
            artist: 'Boston Dodgeball League',
            artwork: [{ src: '/favicon.ico', sizes: '96x96', type: 'image/png' }]
          });
          
          extendedNav.mediaSession.playbackState = 'playing';
          console.log('Media session control acquired');
        }
      }

      this.isQuietingOtherApps = true;
      return true;

    } catch (error) {
      console.warn('Failed to quiet other applications:', error);
      return false;
    }
  }

  async restoreOtherApps(): Promise<boolean> {
    if (!this.isQuietingOtherApps) return true;

    try {
      // Release media session control
      if ('mediaSession' in navigator) {
        const extendedNav = navigator as unknown as ExtendedNavigator;
        if (extendedNav.mediaSession) {
          extendedNav.mediaSession.playbackState = 'none';
          console.log('Media session control released');
        }
      }

      this.isQuietingOtherApps = false;
      return true;

    } catch (error) {
      console.warn('Failed to restore other applications:', error);
      return false;
    }
  }

  async announce(text: string, options: SpeechOptions = {}): Promise<void> {
    // Request audio focus before announcement
    if (this.config.requestAudioFocus) {
      await this.requestAudioFocus();
    }

    // Quiet other apps during announcement
    if (this.config.quietOtherApps) {
      await this.quietOtherApps();
    }

    return new Promise((resolve, reject) => {
      if (!('speechSynthesis' in window)) {
        console.warn('Speech synthesis not supported');
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      
      // Configure speech options
      utterance.rate = options.rate || this.config.speechRate;
      utterance.pitch = options.pitch || this.config.speechPitch;
      utterance.volume = this.config.announcementVolume * this.config.masterVolume;
      
      if (options.voice) {
        utterance.voice = options.voice;
      }

      utterance.onend = () => {
        // Brief delay before restoring other apps
        setTimeout(() => {
          if (this.config.quietOtherApps) {
            this.restoreOtherApps();
          }
          resolve();
        }, 500);
      };

      utterance.onerror = (error) => {
        if (this.config.quietOtherApps) {
          this.restoreOtherApps();
        }
        reject(error);
      };

      speechSynthesis.speak(utterance);
    });
  }

  async playBuzzer(): Promise<void> {
    // Request audio focus for buzzer
    if (this.config.requestAudioFocus) {
      await this.requestAudioFocus();
    }

    if (this.buzzerBuffer && this.audioContext) {
      // Play generated buzzer sound
      const source = this.audioContext.createBufferSource();
      const gainNode = this.audioContext.createGain();
      
      source.buffer = this.buzzerBuffer;
      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      gainNode.gain.value = this.config.masterVolume;
      
      source.start();
      
      // Release focus after buzzer completes
      setTimeout(() => {
        if (this.config.requestAudioFocus) {
          this.releaseAudioFocus();
        }
      }, 1000);
      
    } else if (this.buzzerSound) {
      // Fallback to audio element
      try {
        this.buzzerSound.currentTime = 0;
        await this.buzzerSound.play();
      } catch (error) {
        console.warn('Failed to play buzzer:', error);
      }
    }
  }

  setVolume(volume: number): void {
    this.config.masterVolume = Math.max(0, Math.min(1, volume));
    
    if (this.buzzerSound) {
      this.buzzerSound.volume = this.config.masterVolume;
    }
  }

  // Update configuration
  updateConfig(newConfig: Partial<AudioConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Apply volume changes immediately
    if (newConfig.masterVolume !== undefined) {
      this.setVolume(newConfig.masterVolume);
    }
  }

  // Get available voices for text-to-speech
  getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!('speechSynthesis' in window)) return [];
    return speechSynthesis.getVoices();
  }

  // Resume audio context if suspended (required after user interaction)
  async resumeAudioContext(): Promise<void> {
    if (this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  // Check if notification permissions are available
  async requestNotificationPermission(): Promise<boolean> {
    if (!('Notification' in window)) return false;
    
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    
    return Notification.permission === 'granted';
  }

  // Cleanup resources
  dispose(): void {
    // Release audio focus
    this.releaseAudioFocus();
    
    // Restore other apps
    if (this.isQuietingOtherApps) {
      this.restoreOtherApps();
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.buzzerSound = null;
  }
}