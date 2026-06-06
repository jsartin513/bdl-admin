import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import {
  buildPlayoffSummary,
  buildTeamSchedulesWorkbook,
  gamesByRound,
  groupPhaseRoundStats,
  groupPhaseStreamPlayRounds,
  groupPhaseTeams,
  parseThrowdownScheduleCsv,
} from '../buildTeamSchedules';

const SAMPLE_CSV = readFileSync(
  join(process.cwd(), 'schedule_data', 'schedule_may_27.csv'),
  'utf-8'
);

describe('buildTeamSchedules', () => {
  it('parses throwdown CSV rows', () => {
    const games = parseThrowdownScheduleCsv(SAMPLE_CSV);
    expect(games.length).toBeGreaterThan(40);
    expect(games[0].home).toBe('Black Panther');
    expect(games[0].referees).toBe('Sister Sister');
  });

  it('finds 16 group-phase teams', () => {
    const games = parseThrowdownScheduleCsv(SAMPLE_CSV);
    const teams = groupPhaseTeams(games);
    expect(teams).toHaveLength(16);
    expect(teams).toContain('Black Panther');
    expect(teams).toContain('Kenan & Kel');
  });

  it('computes group phase round stats', () => {
    const games = parseThrowdownScheduleCsv(SAMPLE_CSV);
    const gpByRound = gamesByRound(games, 'Group Phase');
    const [home, away, ref, off] = groupPhaseRoundStats('Black Panther', gpByRound);
    expect(home + away + ref + off).toBe(10);
    expect(home + away).toBeGreaterThan(0);
  });

  it('finds stream court playing rounds', () => {
    const games = parseThrowdownScheduleCsv(SAMPLE_CSV);
    const gpByRound = gamesByRound(games, 'Group Phase');
    const rounds = groupPhaseStreamPlayRounds('Black Panther', gpByRound);
    expect(rounds.length).toBeGreaterThan(0);
    expect(rounds.every((r) => r >= 1 && r <= 10)).toBe(true);
  });

  it('builds playoff summary rows', () => {
    const games = parseThrowdownScheduleCsv(SAMPLE_CSV);
    const playoffByRound = gamesByRound(games, 'Playoff');
    const summary = buildPlayoffSummary(playoffByRound);
    expect(summary.length).toBeGreaterThan(0);
    expect(summary[0].courts).toMatch(/Court/);
  });

  it('creates summary plus one sheet per team', () => {
    const workbook = buildTeamSchedulesWorkbook(SAMPLE_CSV);
    expect(workbook.SheetNames[0]).toBe('Summary');
    expect(workbook.SheetNames).toHaveLength(17);

    const summary = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets.Summary, {
      header: 1,
      defval: '',
    }) as string[][];
    expect(summary[3]?.[0]).toBe('Team');
    expect(summary[4]?.[0]).toBe('Abbott Elementary');

    const blackPantherSheet =
      workbook.Sheets[workbook.SheetNames.find((n) => n.includes('Black Panther'))!];
    const teamRows = XLSX.utils.sheet_to_json<string[]>(blackPantherSheet, {
      header: 1,
      defval: '',
    }) as string[][];
    expect(teamRows[0]?.[0]).toBe('Black Panther');
    expect(teamRows.some((row) => row[3] === 'PLAYING (Home)' || row[3] === 'PLAYING (Away)'))
      .toBe(true);
  });
});
