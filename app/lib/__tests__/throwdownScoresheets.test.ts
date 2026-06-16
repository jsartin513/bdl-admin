import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import {
  buildScoresheetCards,
  formatGameTime,
  groupPhaseGames,
  nextAssignment,
  uniqueCourts,
} from '../throwdownScoresheets';
import { parseTournamentCsv } from '../tournamentSchedule';

const SAMPLE_CSV = readFileSync(
  join(process.cwd(), 'schedule_data', 'schedule_may_27.csv'),
  'utf-8'
);

describe('throwdownScoresheets', () => {
  it('formats game time as 9:00 AM', () => {
    expect(formatGameTime('2026-06-20 09:00 am')).toBe('9:00 AM');
    expect(formatGameTime('2026-06-20 12:05 pm')).toBe('12:05 PM');
  });

  it('builds 40 group-phase scoresheet cards', () => {
    const cards = buildScoresheetCards(SAMPLE_CSV);
    expect(cards).toHaveLength(40);
    expect(uniqueCourts(cards)).toEqual([1, 2, 3, 4]);
    expect(cards.filter((c) => c.court === 1)).toHaveLength(10);
  });

  it('sorts by court then round', () => {
    const cards = buildScoresheetCards(SAMPLE_CSV);
    for (let i = 1; i < cards.length; i++) {
      const prev = cards[i - 1];
      const curr = cards[i];
      expect(
        curr.court > prev.court ||
          (curr.court === prev.court && curr.round >= prev.round)
      ).toBe(true);
    }
  });

  it('fills round 1 court 1 game details', () => {
    const cards = buildScoresheetCards(SAMPLE_CSV);
    const r1c1 = cards.find((c) => c.court === 1 && c.round === 1);
    expect(r1c1).toBeDefined();
    expect(r1c1!.homeTeam).toBe('Black Panther');
    expect(r1c1!.awayTeam).toBe('Proud Family');
    expect(r1c1!.ref).toBe('Sister Sister');
    expect(r1c1!.time).toBe('9:00 AM');
    expect(r1c1!.homeWhereNext).toBe('OFF');
    expect(r1c1!.awayWhereNext).toBe('OFF');
    expect(r1c1!.refWhereNext).toBe('Court 2');
  });

  it('computes next-round assignments', () => {
    const groupGames = groupPhaseGames(parseTournamentCsv(SAMPLE_CSV));
    expect(nextAssignment('Sister Sister', 2, groupGames)).toBe('Court 2');
    expect(nextAssignment('Black Panther', 2, groupGames)).toBe('OFF');
    expect(nextAssignment('Fresh Prince', 2, groupGames)).toBe('Ref Court 1');
  });

  it('uses Bracket for round 10 where-to-next', () => {
    const cards = buildScoresheetCards(SAMPLE_CSV);
    const r10 = cards.filter((c) => c.round === 10);
    expect(r10).toHaveLength(4);
    expect(r10.every((c) => c.homeWhereNext === 'Bracket' && c.awayWhereNext === 'Bracket' && c.refWhereNext === 'Bracket')).toBe(
      true
    );
  });
});
