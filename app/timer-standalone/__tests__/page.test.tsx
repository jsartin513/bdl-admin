import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import StandaloneTimerPage from '../page';
import { TimerPhase } from '../../components/timer/types';

// Mock the DodgeballTimer hook
vi.mock('../../components/timer/DodgeballTimer', () => ({
  default: vi.fn(() => ({
    timerState: {
      totalDuration: 180,
      currentTime: 180,
      isRunning: false,
      isPaused: false,
      phase: TimerPhase.READY,
    },
    audioConfig: {
      masterVolume: 0.9,
      announcementVolume: 1.0,
      speechRate: 0.9,
      speechPitch: 1.1,
      externalMusicReminder: true,
      requestAudioFocus: true,
      systemVolumeControl: false,
      quietOtherApps: true,
    },
    isAudioInitialized: false,
    isPlayingStartAnnouncement: false,
    startTimer: vi.fn().mockResolvedValue(undefined),
    pauseTimer: vi.fn(),
    resetTimer: vi.fn(),
    skipToEnd: vi.fn().mockResolvedValue(undefined),
    updateAudioConfig: vi.fn(),
    formatTime: (seconds: number) => {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    },
    getPhaseText: (phase: TimerPhase) => {
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
    },
  })),
}));

describe('StandaloneTimerPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the timer page', () => {
    render(<StandaloneTimerPage />);
    
    expect(screen.getByText('Round Timer')).toBeInTheDocument();
    expect(screen.getByText('Standalone dodgeball round timer')).toBeInTheDocument();
  });

  it('should display the timer time', () => {
    render(<StandaloneTimerPage />);
    
    expect(screen.getByText('3:00')).toBeInTheDocument();
  });

  it('should display the current phase', () => {
    render(<StandaloneTimerPage />);
    
    expect(screen.getByText('Ready to Start')).toBeInTheDocument();
  });

  it('should render start button when timer is not running', () => {
    render(<StandaloneTimerPage />);
    
    expect(screen.getByText('🏁 START ROUND')).toBeInTheDocument();
  });

  it('should render audio settings section', () => {
    render(<StandaloneTimerPage />);
    
    expect(screen.getByText('Audio Settings')).toBeInTheDocument();
    expect(screen.getByText('Master Volume')).toBeInTheDocument();
    expect(screen.getByText('Announcements')).toBeInTheDocument();
    expect(screen.getByText('Speech Rate')).toBeInTheDocument();
    expect(screen.getByText('Speech Pitch')).toBeInTheDocument();
  });

  it('should render instructions section', () => {
    render(<StandaloneTimerPage />);
    
    expect(screen.getByText('Timer Instructions')).toBeInTheDocument();
    expect(screen.getByText('Round Sequence:')).toBeInTheDocument();
    expect(screen.getByText('Audio Features:')).toBeInTheDocument();
  });
});

