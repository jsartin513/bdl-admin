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
  GameFormat,
  GAME_FORMAT_CONFIGS,
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
  // Get game format config (default to STANDARD)
  const gameFormat = currentGame?.format || GameFormat.STANDARD;
  const formatConfig = GAME_FORMAT_CONFIGS[gameFormat];
  const totalGameDuration = formatConfig.gameDuration + formatConfig.noBlockDuration;

  const [timerState, setTimerState] = useState<TimerState>({
    totalDuration: totalGameDuration,
    currentTime: totalGameDuration,
    isRunning: false,
    isPaused: false,
    phase: TimerPhase.READY
  });

  const [audioConfig, setAudioConfig] = useState<AudioConfig>(DEFAULT_AUDIO_CONFIG);
  const [isAudioInitialized, setIsAudioInitialized] = useState(false);
  const [isPlayingStartAnnouncement, setIsPlayingStartAnnouncement] = useState(false);
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

  // Generate announcements based on current game format and settings
  const generateAnnouncements = useCallback((): AnnouncementConfig[] => {
    const announcements: AnnouncementConfig[] = [];
    const announcementTimes = formatConfig.announcementTimes;

    // Generate announcements based on format config
    announcementTimes.forEach(time => {
      if (formatConfig.hasNoBlockPhase && time <= formatConfig.noBlockDuration) {
        // No-blocking phase announcements
        if (time === formatConfig.noBlockDuration) {
          announcements.push({
            time,
            text: STANDARD_ANNOUNCEMENTS.NO_BLOCKING_IN,
            type: AnnouncementType.NO_BLOCKING_WARNING,
            priority: 5
          });
        } else if (time > 0) {
          announcements.push({
            time,
            text: `${time}`,
            type: AnnouncementType.FINAL_COUNTDOWN,
            priority: 5
          });
        }
      } else {
        // Time warning announcements (for longer formats or before no-block phase)
        const minutesRemaining = Math.floor(time / 60);
        const secondsRemaining = time % 60;
        let text = '';
        
        if (minutesRemaining > 0) {
          text = `${minutesRemaining} minute${minutesRemaining > 1 ? 's' : ''} remaining`;
        } else if (secondsRemaining > 0) {
          text = `${secondsRemaining} second${secondsRemaining > 1 ? 's' : ''} remaining`;
        } else {
          text = 'Time up!';
        }

        announcements.push({
          time,
          text,
          type: time <= 10 ? AnnouncementType.FINAL_COUNTDOWN : AnnouncementType.TIME_WARNING,
          priority: time <= 10 ? 5 : 3
        });
      }
    });

    // End buzzer
    announcements.push({
      time: 0,
      text: '', // No text, just buzzer
      type: AnnouncementType.END,
      priority: 10
    });

    // Sort by time (descending) so earlier announcements come first
    return announcements.sort((a, b) => b.time - a.time);
  }, [formatConfig]);

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

      // Determine phase based on time remaining and format config
      if (newTime <= 0) {
        newPhase = TimerPhase.FINISHED;
      } else if (formatConfig.hasNoBlockPhase && newTime <= formatConfig.noBlockDuration) {
        newPhase = TimerPhase.NO_BLOCKING;
      } else if (prevState.phase === TimerPhase.READY && prevState.isRunning) {
        newPhase = TimerPhase.GAME_ACTIVE;
      } else if (prevState.phase === TimerPhase.GAME_ACTIVE && newTime > formatConfig.noBlockDuration) {
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

  // Reset timer when game changes or format changes
  useEffect(() => {
    const newTotalDuration = formatConfig.gameDuration + formatConfig.noBlockDuration;
    setTimerState({
      totalDuration: newTotalDuration,
      currentTime: newTotalDuration,
      isRunning: false,
      isPaused: false,
      phase: TimerPhase.READY
    });
    
    // Reset start announcement state
    setIsPlayingStartAnnouncement(false);
    
    // Clear announcement queue
    announcementQueueRef.current.clear();
    setIsAudioInitialized(false);
  }, [currentGame?.gameNumber, currentGame?.court1Team1, currentGame?.court2Team1, currentGame?.format, formatConfig]);

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
    
    // Show visual start indication
    setIsPlayingStartAnnouncement(true);
    
    // Play start announcement
    if (audioManagerRef.current) {
      await audioManagerRef.current.announce(STANDARD_ANNOUNCEMENTS.START);
    }

    // Hide visual start indication and start timer
    setIsPlayingStartAnnouncement(false);
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
    const newTotalDuration = formatConfig.gameDuration + formatConfig.noBlockDuration;
    setTimerState({
      totalDuration: newTotalDuration,
      currentTime: newTotalDuration,
      isRunning: false,
      isPaused: false,
      phase: TimerPhase.READY
    });
    
    // Reset start announcement state
    setIsPlayingStartAnnouncement(false);
    
    // Clear announcement queue
    announcementQueueRef.current.clear();
    setIsAudioInitialized(false);
  }, [formatConfig]);

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
    isPlayingStartAnnouncement,
    
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