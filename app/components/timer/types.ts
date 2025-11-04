// Timer component types and interfaces

export interface TimerState {
  totalDuration: number; // Total round duration in seconds (180 for 3 minutes)
  currentTime: number; // Current time remaining in seconds
  isRunning: boolean;
  isPaused: boolean;
  phase: TimerPhase;
}

export enum TimerPhase {
  READY = 'ready',           // Before round starts
  GAME_ACTIVE = 'active',    // During the 3-minute game
  NO_BLOCKING = 'no-blocking', // Final 10-second countdown
  FINISHED = 'finished'      // Round complete
}

export interface AnnouncementConfig {
  time: number; // Time in seconds when announcement should play
  text: string; // Text to announce
  type: AnnouncementType;
  priority: number; // Higher number = higher priority
}

export enum AnnouncementType {
  START = 'start',
  TIME_WARNING = 'time-warning',
  NO_BLOCKING_WARNING = 'no-blocking-warning', 
  FINAL_COUNTDOWN = 'final-countdown',
  TEAM_ANNOUNCEMENT = 'team-announcement',
  END = 'end'
}

export interface AudioConfig {
  masterVolume: number; // 0-1
  announcementVolume: number; // 0-1
  speechRate: number; // Text-to-speech rate (0.5-2.0)
  speechPitch: number; // Text-to-speech pitch (0-2)
  externalMusicReminder: boolean; // Show reminder about external music (Spotify, etc.)
  requestAudioFocus: boolean; // Request exclusive audio focus during announcements
  systemVolumeControl: boolean; // Attempt to control system volume during round
  quietOtherApps: boolean; // Try to reduce volume of other applications
}

export interface TimerAudioManager {
  announce: (text: string, options?: SpeechOptions) => Promise<void>;
  playBuzzer: () => Promise<void>;
  setVolume: (volume: number) => void;
  requestAudioFocus: () => Promise<boolean>;
  releaseAudioFocus: () => void;
  quietOtherApps: () => Promise<boolean>;
  restoreOtherApps: () => Promise<boolean>;
}

export interface SpeechOptions {
  rate?: number;
  pitch?: number;
  voice?: SpeechSynthesisVoice;
}

export interface GameInfo {
  gameNumber: string;
  court1Team1: string;
  court1Team2: string;
  court2Team1: string;
  court2Team2: string;
  court1Ref?: string;
  court2Ref?: string;
  week?: number;
}

export interface NextGameInfo extends GameInfo {
  timeUntilStart?: number; // seconds until this game starts
}

// Default timer configuration
export const DEFAULT_TIMER_CONFIG = {
  ROUND_DURATION: 180, // 3 minutes in seconds
  NO_BLOCKING_START: 10, // Start "no blocking" countdown at 10 seconds
  ANNOUNCEMENT_TIMES: [
    120, // 2 minutes until no blocking
    90,  // 90 seconds until no blocking
    60,  // 1 minute until no blocking
    30,  // 30 seconds until no blocking
    20,  // 20 seconds until no blocking
    10,  // "no blocking in..." then countdown
    9, 8, 7, 6, 5, 4, 3, 2, 1, 0 // Final countdown
  ] as const
};

export const DEFAULT_AUDIO_CONFIG: AudioConfig = {
  masterVolume: 0.8,
  announcementVolume: 1.0,
  speechRate: 1.0,
  speechPitch: 1.0,
  externalMusicReminder: true,
  requestAudioFocus: true,
  systemVolumeControl: false, // Disabled by default due to security restrictions
  quietOtherApps: true
};

// Standard announcements
export const STANDARD_ANNOUNCEMENTS = {
  START: "Side ready, side ready, dodgeball!",
  TWO_MINUTES: "2 minutes until no blocking",
  NINETY_SECONDS: "90 seconds until no blocking", 
  ONE_MINUTE: "1 minute until no blocking",
  THIRTY_SECONDS: "30 seconds until no blocking",
  TWENTY_SECONDS: "20 seconds until no blocking",
  NO_BLOCKING_IN: "No blocking in",
  BUZZER_END: "Round complete"
} as const;