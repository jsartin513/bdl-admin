import { describe, expect, it } from 'vitest';
import {
  buildAudioEvents,
  buildTimeSlots,
  coalesceEventsAtSameTimestamp,
  DEFAULT_SCHEDULE_CONFIG,
  getUniqueMatchupRefsFromSlots,
  getNoBlockingEndMs,
  isPlaceholderTeam,
  matchupSlug,
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
    const preRound = events.find((e) => e.absoluteMs === 0);
    expect(preRound?.label).toContain('court assignments');
    expect(preRound?.label).toContain('round start');
    expect(events.some((e) => e.label.includes('buzzer'))).toBe(true);
    const buzzer = events.find((e) => e.label.includes('buzzer'));
    expect(buzzer?.absoluteMs).toBe(getNoBlockingEndMs(slots[0], DEFAULT_SCHEDULE_CONFIG));
  });

  it('uses compound matchup clips when configured', () => {
    const rows = parseTournamentCsv(SAMPLE_ROW);
    const slots = buildTimeSlots(rows);
    const events = buildAudioEvents(slots, {
      ...DEFAULT_SCHEDULE_CONFIG,
      teamNameMode: 'compound',
    });
    const court = events.find((e) => e.label.includes('court assignments'));
    expect(court?.clips.some((c) => c.category === 'matchups')).toBe(true);
    expect(court?.clips.some((c) => c.slug === matchupSlug('Black Panther', 'Proud Family'))).toBe(
      true
    );
  });

  it('does not schedule no-blocking end countdowns at/after the next court call', () => {
    const csv = `"Date","Court","Phase","Division","Group","Round","Home Team","Home Score","Away Team","Away Score","Referees","End Time"
"2026-06-20 09:00 am","Court 1","Group Phase","Comp Mixed","Group A","1","Black Panther","undefined","Proud Family","undefined","Ref","2026-06-20 09:25"
"2026-06-20 09:25 am","Court 1","Group Phase","Comp Mixed","Group A","2","Fresh Prince","undefined","Family Matters","undefined","Ref","2026-06-20 09:50"`;
    const slots = buildTimeSlots(parseTournamentCsv(csv));
    const config = {
      ...DEFAULT_SCHEDULE_CONFIG,
      noBlockingStartMin: 22,
      noBlockingDurationMin: 3,
      countdownsBeforeNoBlockingEnd: ['ninety_seconds'],
    };
    const events = buildAudioEvents(slots, config);

    const nextCourtCallMs = slots.length > 1 ? Math.max(0, slots[1].startMs - config.courtAssignOffsetMs) : 0;
    const round1CountdownBeforeEnd = events.find(
      (e) =>
        e.slotRound === '1' &&
        e.clips.some((c) => c.category === 'generic' && c.slug === 'ninety_seconds') &&
        e.label.includes('before no blocking ends')
    );

    // It’s OK if the countdown exists (it may even coalesce with no-blocking start),
    // but it must never land at/after the next round’s court call, which would cause overlap/out-of-order audio.
    if (round1CountdownBeforeEnd) {
      expect(round1CountdownBeforeEnd.absoluteMs).toBeLessThan(nextCourtCallMs);
    }

    // (Events at the same timestamp may be coalesced, so slotRound can remain the earlier event’s round.)
    const hasRound2Court = events.some((e) => e.label.includes('Round 2') && e.label.includes('court assignments'));
    expect(hasRound2Court).toBe(true);
  });

  it('merges pre-round events at the same timestamp for the first slot', () => {
    const rows = parseTournamentCsv(SAMPLE_ROW);
    const events = buildAudioEvents(buildTimeSlots(rows));
    const atZero = events.filter((e) => e.absoluteMs === 0);
    expect(atZero).toHaveLength(1);
    expect(atZero[0].clips.length).toBeGreaterThan(3);
  });

  it('coalesceEventsAtSameTimestamp merges clip lists', () => {
    const merged = coalesceEventsAtSameTimestamp([
      {
        absoluteMs: 100,
        clips: [{ category: 'generic', slug: 'vs' }],
        label: 'A',
        slotRound: '1',
      },
      {
        absoluteMs: 100,
        clips: [{ category: 'generic', slug: 'buzzer' }],
        label: 'B',
        slotRound: '1',
      },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].clips).toHaveLength(2);
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

  it('clamps no-blocking start and buzzer to not exceed the next round court call', () => {
    const csv = `"Date","Court","Phase","Division","Group","Round","Home Team","Home Score","Away Team","Away Score","Referees","End Time"
"2026-06-20 09:00 am","Court 1","Group Phase","Comp Mixed","Group A","1","Black Panther","undefined","Proud Family","undefined","Ref","2026-06-20 09:25"
"2026-06-20 09:25 am","Court 1","Group Phase","Comp Mixed","Group A","2","Fresh Prince","undefined","Family Matters","undefined","Ref","2026-06-20 09:50"`;
    const slots = buildTimeSlots(parseTournamentCsv(csv));
    const config = {
      ...DEFAULT_SCHEDULE_CONFIG,
      courtAssignOffsetMs: 90_000,
      noBlockingStartMin: 24,
      noBlockingDurationMin: 3,
    } as const;
    const events = buildAudioEvents(slots, config);

    const round1NoBlockingStart = events.find(
      (e) => e.slotRound === '1' && e.label.includes('no blocking starts')
    );
    const round1Buzzer = events.find((e) => e.slotRound === '1' && e.label.includes('buzzer'));
    const nextCourtCallMs =
      slots.length > 1 ? Math.max(0, slots[1].startMs - config.courtAssignOffsetMs) : Number.POSITIVE_INFINITY;

    expect(round1NoBlockingStart).toBeDefined();
    expect(round1Buzzer).toBeDefined();
    expect(round1NoBlockingStart!.absoluteMs).toBeLessThanOrEqual(nextCourtCallMs);
    expect(round1Buzzer!.absoluteMs).toBeLessThanOrEqual(nextCourtCallMs);
  });

  it('only returns matchups/* refs in compound mode', () => {
    const csv = `"Date","Court","Phase","Division","Group","Round","Home Team","Home Score","Away Team","Away Score","Referees","End Time"
"2026-06-20 09:00 am","Court 1","Group Phase","Comp Mixed","Group A","1","Seed #1","undefined","Proud Family","undefined","Ref","2026-06-20 09:25"
"2026-06-20 09:00 am","Court 2","Group Phase","Comp Mixed","Group A","1","Black Panther","undefined","Fresh Prince","undefined","Ref","2026-06-20 09:25"`;
    const slots = buildTimeSlots(parseTournamentCsv(csv));
    const refs = getUniqueMatchupRefsFromSlots(slots, {
      ...DEFAULT_SCHEDULE_CONFIG,
      teamNameMode: 'compound',
    });

    expect(refs.every((ref) => ref.category === 'matchups')).toBe(true);
    expect(refs.some((ref) => ref.slug === 'playoff_match')).toBe(false);
  });
});
