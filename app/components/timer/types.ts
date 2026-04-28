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
  GAME_ACTIVE = 'active',    // During the game
  NO_BLOCKING = 'no-blocking', // Final countdown (for standard format)
  FINISHED = 'finished'      // Round complete
}

export enum GameFormat {
  STANDARD = 'standard',     // 4 min game + 1 min no-block
  DOUBLE = 'double',         // 20 min continuous
  EXTENDED = 'extended'      // 30-40 min continuous
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
  format?: GameFormat; // Game format (defaults to STANDARD)
}

export interface NextGameInfo extends GameInfo {
  timeUntilStart?: number; // seconds until this game starts
}

// Game format configurations
export interface GameFormatConfig {
  gameDuration: number; // in seconds
  noBlockDuration: number; // in seconds (0 for continuous formats)
  transitionTime: number; // in seconds between games
  announcementTimes: number[]; // Times in seconds when announcements should play
  hasNoBlockPhase: boolean; // Whether this format has a no-blocking phase
}

export const GAME_FORMAT_CONFIGS: Record<GameFormat, GameFormatConfig> = {
  [GameFormat.STANDARD]: {
    gameDuration: 240, // 4 minutes
    noBlockDuration: 60, // 1 minute
    transitionTime: 60, // 1 minute
    hasNoBlockPhase: true,
    announcementTimes: [
      120, // 2 minutes until no blocking
      90,  // 90 seconds until no blocking
      60,  // 1 minute until no blocking
      30,  // 30 seconds until no blocking
      20,  // 20 seconds until no blocking
      10,  // "no blocking in..." then countdown
      9, 8, 7, 6, 5, 4, 3, 2, 1, 0 // Final countdown
    ],
  },
  [GameFormat.DOUBLE]: {
    gameDuration: 1200, // 20 minutes
    noBlockDuration: 0, // No no-block phase for continuous play
    transitionTime: 60, // 1 minute
    hasNoBlockPhase: false,
    announcementTimes: [
      1080, // 18 minutes (2 min remaining)
      900,  // 15 minutes (5 min remaining)
      600,  // 10 minutes (10 min remaining)
      300,  // 5 minutes (15 min remaining)
      180,  // 3 minutes (17 min remaining)
      60,   // 1 minute (19 min remaining)
      30,   // 30 seconds
      10,   // 10 seconds
      5, 4, 3, 2, 1, 0 // Final countdown
    ],
  },
  [GameFormat.EXTENDED]: {
    gameDuration: 2100, // 35 minutes (middle of 30-40 range)
    noBlockDuration: 0, // No no-block phase for continuous play
    transitionTime: 60, // 1 minute
    hasNoBlockPhase: false,
    announcementTimes: [
      1800, // 30 minutes (5 min remaining)
      1500, // 25 minutes (10 min remaining)
      1200, // 20 minutes (15 min remaining)
      900,  // 15 minutes (20 min remaining)
      600,  // 10 minutes (25 min remaining)
      300,  // 5 minutes (30 min remaining)
      180,  // 3 minutes
      60,   // 1 minute
      30,   // 30 seconds
      10,   // 10 seconds
      5, 4, 3, 2, 1, 0 // Final countdown
    ],
  },
};

// Default timer configuration (for backwards compatibility)
export const DEFAULT_TIMER_CONFIG = {
  ROUND_DURATION: 180, // 3 minutes in seconds (legacy)
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