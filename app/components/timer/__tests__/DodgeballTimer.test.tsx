import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import DodgeballTimer from '../DodgeballTimer';
import { TimerPhase, DEFAULT_TIMER_CONFIG } from '../types';

// Mock the audio manager
vi.mock('../EnhancedAudioManager', () => ({
  DodgeballAudioManager: vi.fn().mockImplementation(() => ({
    announce: vi.fn().mockResolvedValue(undefined),
    playBuzzer: vi.fn().mockResolvedValue(undefined),
    resumeAudioContext: vi.fn().mockResolvedValue(undefined),
    requestAudioFocus: vi.fn().mockResolvedValue(true),
    updateConfig: vi.fn(),
    dispose: vi.fn(),
  })),
}));

describe('DodgeballTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should initialize with default timer state', () => {
    const { result } = renderHook(() => DodgeballTimer({}));

    expect(result.current.timerState.currentTime).toBe(DEFAULT_TIMER_CONFIG.ROUND_DURATION);
    expect(result.current.timerState.isRunning).toBe(false);
    expect(result.current.timerState.isPaused).toBe(false);
    expect(result.current.timerState.phase).toBe(TimerPhase.READY);
  });

  it('should start the timer', async () => {
    const onTimerStart = vi.fn();
    const { result } = renderHook(() => DodgeballTimer({ onTimerStart }));

    await result.current.startTimer();

    expect(result.current.timerState.isRunning).toBe(true);
    expect(result.current.timerState.isPaused).toBe(false);
    expect(result.current.timerState.phase).toBe(TimerPhase.GAME_ACTIVE);
    expect(onTimerStart).toHaveBeenCalled();
  });

  it('should pause and resume the timer', async () => {
    const { result } = renderHook(() => DodgeballTimer({}));

    await result.current.startTimer();
    expect(result.current.timerState.isRunning).toBe(true);

    result.current.pauseTimer();
    expect(result.current.timerState.isPaused).toBe(true);

    result.current.pauseTimer();
    expect(result.current.timerState.isPaused).toBe(false);
  });

  it('should reset the timer', async () => {
    const { result } = renderHook(() => DodgeballTimer({}));

    await result.current.startTimer();
    expect(result.current.timerState.isRunning).toBe(true);

    result.current.resetTimer();
    expect(result.current.timerState.isRunning).toBe(false);
    expect(result.current.timerState.currentTime).toBe(DEFAULT_TIMER_CONFIG.ROUND_DURATION);
    expect(result.current.timerState.phase).toBe(TimerPhase.READY);
  });

  it('should skip to end', async () => {
    const onTimerComplete = vi.fn();
    const { result } = renderHook(() => DodgeballTimer({ onTimerComplete }));

    await act(async () => {
      await result.current.startTimer();
      await result.current.skipToEnd();
    });

    // Wait for the setTimeout in skipToEnd
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.timerState.currentTime).toBe(0);
    expect(result.current.timerState.phase).toBe(TimerPhase.FINISHED);
    expect(result.current.timerState.isRunning).toBe(false);
    expect(onTimerComplete).toHaveBeenCalled();
  });

  it('should count down when running', async () => {
    const { result } = renderHook(() => DodgeballTimer({}));

    await act(async () => {
      await result.current.startTimer();
    });

    const initialTime = result.current.timerState.currentTime;

    // Advance time by 5 seconds - this will trigger the interval
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });

    expect(result.current.timerState.currentTime).toBeLessThan(initialTime);
    expect(result.current.timerState.currentTime).toBe(initialTime - 5);
  });

  it('should transition to NO_BLOCKING phase at 10 seconds', async () => {
    const { result } = renderHook(() => DodgeballTimer({}));

    await act(async () => {
      await result.current.startTimer();
    });

    // Fast-forward to 10 seconds remaining
    await act(async () => {
      vi.advanceTimersByTime((DEFAULT_TIMER_CONFIG.ROUND_DURATION - 10) * 1000);
    });

    expect(result.current.timerState.phase).toBe(TimerPhase.NO_BLOCKING);
    expect(result.current.timerState.currentTime).toBe(10);
  });

  it('should transition to FINISHED phase when timer reaches 0', async () => {
    const onTimerComplete = vi.fn();
    const { result } = renderHook(() => DodgeballTimer({ onTimerComplete }));

    await act(async () => {
      await result.current.startTimer();
    });

    // Fast-forward to end
    await act(async () => {
      vi.advanceTimersByTime(DEFAULT_TIMER_CONFIG.ROUND_DURATION * 1000);
    });

    // Wait for the setTimeout in the tick function
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(result.current.timerState.phase).toBe(TimerPhase.FINISHED);
    expect(result.current.timerState.currentTime).toBe(0);
    expect(onTimerComplete).toHaveBeenCalled();
  });

  it('should format time correctly', () => {
    const { result } = renderHook(() => DodgeballTimer({}));

    expect(result.current.formatTime(180)).toBe('3:00');
    expect(result.current.formatTime(125)).toBe('2:05');
    expect(result.current.formatTime(65)).toBe('1:05');
    expect(result.current.formatTime(5)).toBe('0:05');
    expect(result.current.formatTime(0)).toBe('0:00');
  });

  it('should get phase text correctly', () => {
    const { result } = renderHook(() => DodgeballTimer({}));

    expect(result.current.getPhaseText(TimerPhase.READY)).toBe('Ready to Start');
    expect(result.current.getPhaseText(TimerPhase.GAME_ACTIVE)).toBe('Game Active');
    expect(result.current.getPhaseText(TimerPhase.NO_BLOCKING)).toBe('No Blocking!');
    expect(result.current.getPhaseText(TimerPhase.FINISHED)).toBe('Round Complete');
  });

  it('should update audio configuration', () => {
    const { result } = renderHook(() => DodgeballTimer({}));

    const newVolume = 0.5;
    result.current.updateAudioConfig({ masterVolume: newVolume });

    expect(result.current.audioConfig.masterVolume).toBe(newVolume);
  });

  it('should reset when game changes', async () => {
    const game1 = {
      gameNumber: 'Game 1',
      court1Team1: 'Team A',
      court1Team2: 'Team B',
      court2Team1: 'Team C',
      court2Team2: 'Team D',
    };

    const { result, rerender } = renderHook(
      ({ game }) => DodgeballTimer({ currentGame: game }),
      { initialProps: { game: game1 } }
    );

    await act(async () => {
      await result.current.startTimer();
    });
    expect(result.current.timerState.isRunning).toBe(true);

    // Change game
    await act(async () => {
      rerender({ game: { ...game1, gameNumber: 'Game 2' } });
    });

    expect(result.current.timerState.isRunning).toBe(false);
    expect(result.current.timerState.currentTime).toBe(DEFAULT_TIMER_CONFIG.ROUND_DURATION);
  });
});

