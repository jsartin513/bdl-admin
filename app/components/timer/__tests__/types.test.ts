import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TIMER_CONFIG,
  DEFAULT_AUDIO_CONFIG,
  STANDARD_ANNOUNCEMENTS,
  TimerPhase,
  AnnouncementType,
} from '../types';

describe('Timer Types and Constants', () => {
  describe('DEFAULT_TIMER_CONFIG', () => {
    it('should have correct round duration', () => {
      expect(DEFAULT_TIMER_CONFIG.ROUND_DURATION).toBe(180); // 3 minutes
    });

    it('should have correct no blocking start time', () => {
      expect(DEFAULT_TIMER_CONFIG.NO_BLOCKING_START).toBe(10);
    });

    it('should include all announcement times', () => {
      expect(DEFAULT_TIMER_CONFIG.ANNOUNCEMENT_TIMES).toContain(120);
      expect(DEFAULT_TIMER_CONFIG.ANNOUNCEMENT_TIMES).toContain(90);
      expect(DEFAULT_TIMER_CONFIG.ANNOUNCEMENT_TIMES).toContain(60);
      expect(DEFAULT_TIMER_CONFIG.ANNOUNCEMENT_TIMES).toContain(30);
      expect(DEFAULT_TIMER_CONFIG.ANNOUNCEMENT_TIMES).toContain(20);
      expect(DEFAULT_TIMER_CONFIG.ANNOUNCEMENT_TIMES).toContain(10);
    });
  });

  describe('DEFAULT_AUDIO_CONFIG', () => {
    it('should have valid volume values', () => {
      expect(DEFAULT_AUDIO_CONFIG.masterVolume).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_AUDIO_CONFIG.masterVolume).toBeLessThanOrEqual(1);
      expect(DEFAULT_AUDIO_CONFIG.announcementVolume).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_AUDIO_CONFIG.announcementVolume).toBeLessThanOrEqual(1);
    });

    it('should have valid speech settings', () => {
      expect(DEFAULT_AUDIO_CONFIG.speechRate).toBeGreaterThanOrEqual(0.5);
      expect(DEFAULT_AUDIO_CONFIG.speechRate).toBeLessThanOrEqual(2.0);
      expect(DEFAULT_AUDIO_CONFIG.speechPitch).toBeGreaterThanOrEqual(0);
      expect(DEFAULT_AUDIO_CONFIG.speechPitch).toBeLessThanOrEqual(2);
    });
  });

  describe('STANDARD_ANNOUNCEMENTS', () => {
    it('should have all required announcement texts', () => {
      expect(STANDARD_ANNOUNCEMENTS.START).toBeTruthy();
      expect(STANDARD_ANNOUNCEMENTS.TWO_MINUTES).toBeTruthy();
      expect(STANDARD_ANNOUNCEMENTS.NINETY_SECONDS).toBeTruthy();
      expect(STANDARD_ANNOUNCEMENTS.ONE_MINUTE).toBeTruthy();
      expect(STANDARD_ANNOUNCEMENTS.THIRTY_SECONDS).toBeTruthy();
      expect(STANDARD_ANNOUNCEMENTS.TWENTY_SECONDS).toBeTruthy();
      expect(STANDARD_ANNOUNCEMENTS.NO_BLOCKING_IN).toBeTruthy();
    });

    it('should have correct start announcement', () => {
      expect(STANDARD_ANNOUNCEMENTS.START).toBe('Side ready, side ready, dodgeball!');
    });
  });

  describe('TimerPhase enum', () => {
    it('should have all required phases', () => {
      expect(TimerPhase.READY).toBe('ready');
      expect(TimerPhase.GAME_ACTIVE).toBe('active');
      expect(TimerPhase.NO_BLOCKING).toBe('no-blocking');
      expect(TimerPhase.FINISHED).toBe('finished');
    });
  });

  describe('AnnouncementType enum', () => {
    it('should have all required announcement types', () => {
      expect(AnnouncementType.START).toBe('start');
      expect(AnnouncementType.TIME_WARNING).toBe('time-warning');
      expect(AnnouncementType.NO_BLOCKING_WARNING).toBe('no-blocking-warning');
      expect(AnnouncementType.FINAL_COUNTDOWN).toBe('final-countdown');
      expect(AnnouncementType.TEAM_ANNOUNCEMENT).toBe('team-announcement');
      expect(AnnouncementType.END).toBe('end');
    });
  });
});

