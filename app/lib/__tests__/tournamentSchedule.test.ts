import { describe, expect, it } from 'vitest';
import {
  buildAudioEvents,
  buildTimeSlots,
  isPlaceholderTeam,
  parseTournamentCsv,
  teamNameToSlug,
} from '../tournamentSchedule';

const SAMPLE_ROW = `"Date","Court","Phase","Division","Group","Round","Home Team","Home Score","Away Team","Away Score","Referees","End Time"
"2026-06-20 09:00 am","Court 1","Group Phase","Comp Mixed","Group A","1","Black Panther","undefined","Proud Family","undefined","Sister Sister","2026-06-20 09:25"
"2026-06-20 09:00 am","Court 2","Group Phase","Comp Mixed","Group A","1","Fresh Prince","undefined","Family Matters","undefined","Abbott Elementary","2026-06-20 09:25"`;

describe('tournamentSchedule', () => {
  it('parses CSV rows', () => {
    const rows = parseTournamentCsv(SAMPLE_ROW);
    expect(rows).toHaveLength(2);
    expect(rows[0].homeTeam).toBe('Black Panther');
    expect(rows[0].court).toBe('Court 1');
  });

  it('slugifies team names', () => {
    expect(teamNameToSlug("That's So Raven")).toBe('thats-so-raven');
    expect(teamNameToSlug('Kenan & Kel')).toBe('kenan-and-kel');
  });

  it('detects placeholder teams', () => {
    expect(isPlaceholderTeam('Seed #1')).toBe(true);
    expect(isPlaceholderTeam('Winner of #1')).toBe(true);
    expect(isPlaceholderTeam('Black Panther')).toBe(false);
  });

  it('builds time slots grouped by date', () => {
    const rows = parseTournamentCsv(SAMPLE_ROW);
    const slots = buildTimeSlots(rows);
    expect(slots).toHaveLength(1);
    expect(slots[0].matches).toHaveLength(2);
    expect(slots[0].durationMs).toBeGreaterThan(0);
  });

  it('builds audio events for a slot', () => {
    const rows = parseTournamentCsv(SAMPLE_ROW);
    const slots = buildTimeSlots(rows);
    const events = buildAudioEvents(slots);
    expect(events.length).toBeGreaterThanOrEqual(5);
    expect(events.some((e) => e.label.includes('court assignments'))).toBe(true);
    expect(events.some((e) => e.label.includes('round start'))).toBe(true);
  });

  it('omits late-slot warnings that would collide with the next round court call', () => {
    const csv = `"Date","Court","Phase","Division","Group","Round","Home Team","Home Score","Away Team","Away Score","Referees","End Time"
"2026-06-20 09:00 am","Court 1","Group Phase","Comp Mixed","Group A","1","Black Panther","undefined","Proud Family","undefined","Ref","2026-06-20 09:25"
"2026-06-20 09:25 am","Court 1","Group Phase","Comp Mixed","Group A","2","Fresh Prince","undefined","Family Matters","undefined","Ref","2026-06-20 09:50"`;
    const slots = buildTimeSlots(parseTournamentCsv(csv));
    const events = buildAudioEvents(slots);

    const round1Ninety = events.find(
      (e) => e.slotRound === '1' && e.label.includes('90 seconds')
    );
    expect(round1Ninety).toBeUndefined();

    const round2Court = events.find(
      (e) => e.slotRound === '2' && e.label.includes('court assignments')
    );
    expect(round2Court).toBeDefined();
  });

  it('keeps events in non-decreasing time order', () => {
    const csv = `"Date","Court","Phase","Division","Group","Round","Home Team","Home Score","Away Team","Away Score","Referees","End Time"
"2026-06-20 09:00 am","Court 1","Group Phase","Comp Mixed","Group A","1","Black Panther","undefined","Proud Family","undefined","Ref","2026-06-20 09:25"
"2026-06-20 09:25 am","Court 1","Group Phase","Comp Mixed","Group A","2","Fresh Prince","undefined","Family Matters","undefined","Ref","2026-06-20 09:50"`;
    const events = buildAudioEvents(buildTimeSlots(parseTournamentCsv(csv)));
    for (let i = 1; i < events.length; i++) {
      expect(events[i].absoluteMs).toBeGreaterThanOrEqual(events[i - 1].absoluteMs);
    }
  });
});
