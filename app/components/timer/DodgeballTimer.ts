'use client'

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  TimerState, 
  TimerPhase, 
  AnnouncementConfig, 
  AnnouncementType,
  AudioConfig,
  GameInfo,
  NextGameInfo,
  DEFAULT_TIMER_CONFIG,
  DEFAULT_AUDIO_CONFIG,
  STANDARD_ANNOUNCEMENTS
} from './types';
import { DodgeballAudioManager } from './EnhancedAudioManager';

interface DodgeballTimerProps {
  currentGame?: GameInfo;
  nextGame?: NextGameInfo;
  onTimerComplete?: () => void;
  onTimerStart?: () => void;
}

export default function DodgeballTimer({ 
  currentGame, 
  nextGame, 
  onTimerComplete, 
  onTimerStart
}: DodgeballTimerProps) {
  const [timerState, setTimerState] = useState<TimerState>({
    totalDuration: DEFAULT_TIMER_CONFIG.ROUND_DURATION,
    currentTime: DEFAULT_TIMER_CONFIG.ROUND_DURATION,
    isRunning: false,
    isPaused: false,
    phase: TimerPhase.READY
  });

  const [audioConfig, setAudioConfig] = useState<AudioConfig>(DEFAULT_AUDIO_CONFIG);
  const [isAudioInitialized, setIsAudioInitialized] = useState(false);
  const [announcements, setAnnouncements] = useState<AnnouncementConfig[]>([]);

  const audioManagerRef = useRef<DodgeballAudioManager | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const announcementQueueRef = useRef<Set<number>>(new Set());

  // Initialize audio manager
  useEffect(() => {
    audioManagerRef.current = new DodgeballAudioManager(audioConfig);
    return () => {
      audioManagerRef.current?.dispose();
    };
  }, [audioConfig]);

  // Generate announcements based on current game and settings
  const generateAnnouncements = useCallback((): AnnouncementConfig[] => {
    const announcements: AnnouncementConfig[] = [];

    // Time warning announcements
    announcements.push({
      time: 120, // 2 minutes until no blocking
      text: STANDARD_ANNOUNCEMENTS.TWO_MINUTES,
      type: AnnouncementType.TIME_WARNING,
      priority: 3
    });

    announcements.push({
      time: 90, // 90 seconds until no blocking
      text: STANDARD_ANNOUNCEMENTS.NINETY_SECONDS,
      type: AnnouncementType.TIME_WARNING,
      priority: 3
    });

    announcements.push({
      time: 60, // 1 minute until no blocking
      text: STANDARD_ANNOUNCEMENTS.ONE_MINUTE,
      type: AnnouncementType.TIME_WARNING,
      priority: 3
    });

    announcements.push({
      time: 30, // 30 seconds until no blocking
      text: STANDARD_ANNOUNCEMENTS.THIRTY_SECONDS,
      type: AnnouncementType.TIME_WARNING,
      priority: 3
    });

    announcements.push({
      time: 20, // 20 seconds until no blocking
      text: STANDARD_ANNOUNCEMENTS.TWENTY_SECONDS,
      type: AnnouncementType.TIME_WARNING,
      priority: 3
    });

    // "No blocking in" announcement - start at 13 seconds
    announcements.push({
      time: 13,
      text: STANDARD_ANNOUNCEMENTS.NO_BLOCKING_IN,
      type: AnnouncementType.NO_BLOCKING_WARNING,
      priority: 5
    });

    // Final countdown from 10
    for (let i = 10; i >= 1; i--) {
      announcements.push({
        time: i,
        text: i.toString(),
        type: AnnouncementType.FINAL_COUNTDOWN,
        priority: 10
      });
    }

    // End buzzer
    announcements.push({
      time: 0,
      text: '', // No text, just buzzer
      type: AnnouncementType.END,
      priority: 10
    });

    return announcements;
  }, []);

  // Initialize announcements
  useEffect(() => {
    setAnnouncements(generateAnnouncements());
  }, [generateAnnouncements]);

  // Play announcement
  const playAnnouncement = useCallback(async (announcement: AnnouncementConfig) => {
    if (!audioManagerRef.current) return;

    try {
      if (announcement.type === AnnouncementType.END) {
        // Play buzzer for end of round
        await audioManagerRef.current.playBuzzer();
      } else if (announcement.text) {
        // Play text-to-speech announcement
        await audioManagerRef.current.announce(announcement.text);
      }
    } catch (error) {
      console.warn('Failed to play announcement:', error);
    }
  }, []);

  // Handle timer tick
  const tick = useCallback(() => {
    setTimerState(prevState => {
      if (!prevState.isRunning || prevState.isPaused) return prevState;

      const newTime = Math.max(0, prevState.currentTime - 1);
      let newPhase = prevState.phase;

      // Determine phase based on time remaining
      if (newTime <= 0) {
        newPhase = TimerPhase.FINISHED;
      } else if (newTime <= 10) {
        newPhase = TimerPhase.NO_BLOCKING;
      } else if (prevState.phase === TimerPhase.READY && prevState.isRunning) {
        newPhase = TimerPhase.GAME_ACTIVE;
      }

      // Check for announcements at this time
      const currentAnnouncements = announcements.filter(a => a.time === newTime);
      currentAnnouncements.forEach(announcement => {
        if (!announcementQueueRef.current.has(announcement.time)) {
          announcementQueueRef.current.add(announcement.time);
          playAnnouncement(announcement);
        }
      });

      // Handle timer completion
      if (newTime === 0 && prevState.currentTime > 0) {
        setTimeout(() => {
          onTimerComplete?.();
        }, 1000); // Delay to allow final announcements to play
      }

      return {
        ...prevState,
        currentTime: newTime,
        phase: newPhase,
        isRunning: newTime > 0 && newPhase !== TimerPhase.FINISHED
      };
    });
  }, [announcements, onTimerComplete, playAnnouncement]);

  // Start timer effect
  useEffect(() => {
    if (timerState.isRunning && !timerState.isPaused) {
      intervalRef.current = setInterval(tick, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timerState.isRunning, timerState.isPaused, tick]);

  // Reset timer when game changes
  useEffect(() => {
    setTimerState({
      totalDuration: DEFAULT_TIMER_CONFIG.ROUND_DURATION,
      currentTime: DEFAULT_TIMER_CONFIG.ROUND_DURATION,
      isRunning: false,
      isPaused: false,
      phase: TimerPhase.READY
    });
    
    // Clear announcement queue
    announcementQueueRef.current.clear();
    setIsAudioInitialized(false);
  }, [currentGame?.gameNumber, currentGame?.court1Team1, currentGame?.court2Team1]); // Reset when game changes

  // Initialize audio on first user interaction
  const initializeAudio = useCallback(async () => {
    if (!audioManagerRef.current || isAudioInitialized) return;

    try {
      await audioManagerRef.current.resumeAudioContext();
      await audioManagerRef.current.requestAudioFocus();
      setIsAudioInitialized(true);
    } catch (error) {
      console.warn('Failed to initialize audio:', error);
    }
  }, [isAudioInitialized]);

  // Timer control functions
  const startTimer = useCallback(async () => {
    await initializeAudio();
    
    // Play start announcement
    if (audioManagerRef.current) {
      await audioManagerRef.current.announce(STANDARD_ANNOUNCEMENTS.START);
    }

    setTimerState(prev => ({
      ...prev,
      isRunning: true,
      isPaused: false,
      phase: TimerPhase.GAME_ACTIVE
    }));

    // Clear previous announcement queue
    announcementQueueRef.current.clear();
    onTimerStart?.();
  }, [initializeAudio, onTimerStart]);

  const pauseTimer = useCallback(() => {
    setTimerState(prev => ({
      ...prev,
      isPaused: !prev.isPaused
    }));
  }, []);

  const resetTimer = useCallback(() => {
    setTimerState({
      totalDuration: DEFAULT_TIMER_CONFIG.ROUND_DURATION,
      currentTime: DEFAULT_TIMER_CONFIG.ROUND_DURATION,
      isRunning: false,
      isPaused: false,
      phase: TimerPhase.READY
    });
    
    // Clear announcement queue
    announcementQueueRef.current.clear();
    setIsAudioInitialized(false);
  }, []);

  const skipToEnd = useCallback(async () => {
    // Play buzzer and end announcement
    if (audioManagerRef.current) {
      await audioManagerRef.current.playBuzzer();
    }
    
    // Set timer to finished state
    setTimerState(prev => ({
      ...prev,
      currentTime: 0,
      isRunning: false,
      isPaused: false,
      phase: TimerPhase.FINISHED
    }));
    
    // Trigger completion callback
    setTimeout(() => {
      onTimerComplete?.();
    }, 500);
  }, [onTimerComplete]);

  const stopTimer = useCallback(() => {
    setTimerState(prev => ({
      ...prev,
      isRunning: false,
      isPaused: false
    }));
  }, []);

  // Update audio configuration
  const updateAudioConfig = useCallback((newConfig: Partial<AudioConfig>) => {
    const updatedConfig = { ...audioConfig, ...newConfig };
    setAudioConfig(updatedConfig);
    audioManagerRef.current?.updateConfig(newConfig);
  }, [audioConfig]);

  // Format time display
  const formatTime = useCallback((seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }, []);

  // Get phase display text
  const getPhaseText = useCallback((phase: TimerPhase): string => {
    switch (phase) {
      case TimerPhase.READY:
        return 'Ready to Start';
      case TimerPhase.GAME_ACTIVE:
        return 'Game Active';
      case TimerPhase.NO_BLOCKING:
        return 'No Blocking!';
      case TimerPhase.FINISHED:
        return 'Round Complete';
      default:
        return '';
    }
  }, []);

  return {
    // State
    timerState,
    audioConfig,
    isAudioInitialized,
    
    // Controls
    startTimer,
    pauseTimer,
    resetTimer,
    stopTimer,
    skipToEnd,
    
    // Configuration
    updateAudioConfig,
    
    // Utilities
    formatTime,
    getPhaseText,
    
    // Current game info
    currentGame,
    nextGame
  };
}