import * as XLSX from 'xlsx';
import { splitCsvLine } from './scheduleParser';

export const STREAM_COURT = 'Court 1';

export interface GameRow {
  date: string;
  court: string;
  phase: string;
  group: string;
  roundNum: number;
  home: string;
  away: string;
  referees: string;
}

export interface PlayoffSummaryRow {
  round: number;
  time: string;
  description: string;
  courts: string;
}

function cleanTeam(value: string | undefined): string {
  const t = (value ?? '').trim();
  if (t.toLowerCase() === 'undefined') return '';
  return t;
}

function headerIndex(header: string[], name: string): number {
  const lower = name.toLowerCase();
  return header.findIndex((h) => h.includes(lower));
}

export function parseThrowdownScheduleCsv(csvText: string): GameRow[] {
  const normalized = csvText.replace(/^\uFEFF/, '');
  const lines = normalized.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];

  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const dateIdx = headerIndex(header, 'date');
  const courtIdx = headerIndex(header, 'court');
  const phaseIdx = headerIndex(header, 'phase');
  const groupIdx = headerIndex(header, 'group');
  const roundIdx = headerIndex(header, 'round');
  const homeIdx = headerIndex(header, 'home team');
  const awayIdx = headerIndex(header, 'away team');
  const refIdx = headerIndex(header, 'referee');

  const rows: GameRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const get = (n: number) => (n >= 0 ? cells[n]?.trim() ?? '' : '');
    rows.push({
      date: get(dateIdx),
      court: get(courtIdx),
      phase: get(phaseIdx),
      group: get(groupIdx),
      roundNum: parseInt(get(roundIdx) || '0', 10) || 0,
      home: cleanTeam(get(homeIdx)),
      away: cleanTeam(get(awayIdx)),
      referees: cleanTeam(get(refIdx)),
    });
  }
  return rows;
}

export function groupPhaseTeams(games: GameRow[]): string[] {
  const names = new Set<string>();
  for (const g of games) {
    if (g.phase !== 'Group Phase') continue;
    if (g.home) names.add(g.home);
    if (g.away) names.add(g.away);
  }
  return [...names].sort();
}

export function gamesByRound(games: GameRow[], phase: string): Map<number, GameRow[]> {
  const out = new Map<number, GameRow[]>();
  for (const g of games) {
    if (g.phase !== phase) continue;
    const list = out.get(g.roundNum) ?? [];
    list.push(g);
    out.set(g.roundNum, list);
  }
  for (const [round, list] of out) {
    list.sort((a, b) => a.court.localeCompare(b.court) || a.date.localeCompare(b.date));
    out.set(round, list);
  }
  return out;
}

export function excelSheetTitle(name: string, used: Set<string>): string {
  const bad = '[]:*?/\\';
  let base = [...name].map((c) => (bad.includes(c) ? '_' : c)).join('');
  if (base.length > 31) base = base.slice(0, 31);

  let candidate = base;
  let n = 2;
  while (used.has(candidate)) {
    const suffix = ` (${n})`;
    candidate =
      base.length + suffix.length > 31 ? base.slice(0, 31 - suffix.length) + suffix : base + suffix;
    n += 1;
  }
  used.add(candidate);
  return candidate;
}

export function groupPhaseRoundStats(
  team: string,
  gpByRound: Map<number, GameRow[]>
): [number, number, number, number] {
  const gpRounds = [...gpByRound.keys()].filter((k) => k >= 1 && k <= 10).sort((a, b) => a - b);
  let homeC = 0;
  let awayC = 0;
  let refC = 0;
  let offC = 0;

  for (const rnd of gpRounds) {
    const games = gpByRound.get(rnd)!;
    if (games.some((g) => g.home === team)) homeC += 1;
    else if (games.some((g) => g.away === team)) awayC += 1;
    else if (games.some((g) => g.referees === team)) refC += 1;
    else offC += 1;
  }
  return [homeC, awayC, refC, offC];
}

export function groupPhaseStreamPlayRounds(
  team: string,
  gpByRound: Map<number, GameRow[]>
): number[] {
  const rounds: number[] = [];
  for (const rnd of [...gpByRound.keys()].filter((k) => k >= 1 && k <= 10).sort((a, b) => a - b)) {
    for (const g of gpByRound.get(rnd) ?? []) {
      if (g.court !== STREAM_COURT) continue;
      if (g.home === team || g.away === team) {
        rounds.push(rnd);
        break;
      }
    }
  }
  return rounds;
}

export function buildPlayoffSummary(
  playoffByRound: Map<number, GameRow[]>
): PlayoffSummaryRow[] {
  const summary: PlayoffSummaryRow[] = [];
  for (const rnd of [...playoffByRound.keys()].sort((a, b) => a - b)) {
    const games = playoffByRound.get(rnd) ?? [];
    if (games.length === 0) continue;

    const time = games[0].date;
    const uniqueGroups = [...new Set(games.map((g) => g.group))];
    const description = uniqueGroups.length > 0 ? uniqueGroups.join(' | ') : 'Playoff block';

    const courtNums = games
      .map((g) => g.court.replace('Court ', '').trim())
      .filter((c) => /^\d+$/.test(c))
      .map((c) => parseInt(c, 10));

    let courts: string;
    if (courtNums.length > 0) {
      const lo = Math.min(...courtNums);
      const hi = Math.max(...courtNums);
      courts = lo !== hi ? `Courts ${lo}–${hi}` : `Court ${lo}`;
    } else {
      courts = games.map((g) => g.court).join(', ');
    }

    summary.push({ round: rnd, time, description, courts });
  }
  return summary;
}

function buildSummarySheetRows(teams: string[], gpByRound: Map<number, GameRow[]>): string[][] {
  const rows: string[][] = [
    ['Group phase — team summary'],
    ['Throw Down — group rounds 1–10'],
    [],
    [
      'Team',
      'Home',
      'Away',
      'Ref',
      'Off',
      'Total rounds',
      'Playing total',
      'Court 1 (stream) — playing rounds',
    ],
  ];

  for (const team of teams) {
    const [h, a, r, o] = groupPhaseRoundStats(team, gpByRound);
    const total = h + a + r + o;
    const play = h + a;
    const c1Rounds = groupPhaseStreamPlayRounds(team, gpByRound);
    const c1Str = c1Rounds.length > 0 ? c1Rounds.join(', ') : '—';
    rows.push([team, String(h), String(a), String(r), String(o), String(total), String(play), c1Str]);
  }
  return rows;
}

function buildTeamSheetRows(
  team: string,
  gpByRound: Map<number, GameRow[]>,
  playoffSummary: PlayoffSummaryRow[]
): string[][] {
  const rows: string[][] = [
    [team],
    ['Throw Down — schedule export'],
    [],
    ['Round', 'Time', 'Court', 'Status', 'Home Team', 'Away Team', 'Ref Team'],
  ];

  const gpRounds = [...gpByRound.keys()].filter((k) => k >= 1 && k <= 10).sort((a, b) => a - b);
  let nPlay = 0;
  let nRef = 0;

  for (const rnd of gpRounds) {
    const games = gpByRound.get(rnd)!;
    const roundTime = games[0].date;
    const playingHome = games.find((g) => g.home === team);
    const playingAway = games.find((g) => g.away === team);
    const reffing = games.find((g) => g.referees === team);

    if (playingHome) {
      nPlay += 1;
      rows.push([
        String(rnd),
        roundTime,
        playingHome.court,
        'PLAYING (Home)',
        playingHome.home,
        playingHome.away,
        playingHome.referees,
      ]);
    } else if (playingAway) {
      nPlay += 1;
      rows.push([
        String(rnd),
        roundTime,
        playingAway.court,
        'PLAYING (Away)',
        playingAway.home,
        playingAway.away,
        playingAway.referees,
      ]);
    } else if (reffing) {
      nRef += 1;
      rows.push([
        String(rnd),
        roundTime,
        reffing.court,
        'REFFING',
        reffing.home,
        reffing.away,
        reffing.referees,
      ]);
    } else {
      rows.push([String(rnd), roundTime, '—', 'OFF', '—', '—', '—']);
    }
  }

  const nOff = gpRounds.length - nPlay - nRef;
  rows.push([]);
  rows.push([
    `Group phase summary — Playing: ${nPlay} rounds • Reffing: ${nRef} rounds • Off: ${nOff} rounds`,
  ]);
  rows.push([]);
  rows.push(['Playoffs — Bracket TBD Based on Seeding']);
  rows.push(['Round', 'Time', 'Phase / matches', 'Courts']);

  for (const row of playoffSummary) {
    rows.push([String(row.round), row.time, row.description, row.courts]);
  }

  return rows;
}

function applyColumnWidths(ws: XLSX.WorkSheet, widths: number[]): void {
  ws['!cols'] = widths.map((wch) => ({ wch }));
}

export function buildTeamSchedulesWorkbook(csvText: string): XLSX.WorkBook {
  const games = parseThrowdownScheduleCsv(csvText);
  const teams = groupPhaseTeams(games);
  const gpByRound = gamesByRound(games, 'Group Phase');
  const playoffByRound = gamesByRound(games, 'Playoff');
  const playoffSummary = buildPlayoffSummary(playoffByRound);

  const workbook = XLSX.utils.book_new();

  const summarySheet = XLSX.utils.aoa_to_sheet(buildSummarySheetRows(teams, gpByRound));
  applyColumnWidths(summarySheet, [28, 10, 10, 10, 10, 14, 14, 32]);
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');

  const usedTitles = new Set<string>(['Summary']);
  for (const team of teams) {
    const title = excelSheetTitle(team, usedTitles);
    const teamSheet = XLSX.utils.aoa_to_sheet(
      buildTeamSheetRows(team, gpByRound, playoffSummary)
    );
    applyColumnWidths(teamSheet, [10, 22, 12, 18, 22, 22, 22]);
    XLSX.utils.book_append_sheet(workbook, teamSheet, title);
  }

  return workbook;
}

export function buildTeamSchedulesBuffer(csvText: string): Buffer {
  const workbook = buildTeamSchedulesWorkbook(csvText);
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

export function defaultTeamSchedulesFilename(): string {
  return 'Throw_Down_Team_Schedules.xlsx';
}
