import * as XLSX from 'xlsx';
import { parseScheduleDateTime, parseTournamentCsv, type ScheduleRow } from './tournamentSchedule';

export interface ScoresheetCard {
  court: number;
  courtLabel: string;
  round: number;
  time: string;
  ref: string;
  homeTeam: string;
  awayTeam: string;
  homeWhereNext: string;
  awayWhereNext: string;
  refWhereNext: string;
}

const GROUP_PHASE = 'group phase';
const MAX_GROUP_ROUND = 10;

function cleanTeamName(name: string): string {
  const t = name.trim();
  if (!t || t.toLowerCase() === 'undefined') return '';
  return t;
}

export function courtNumberFromLabel(court: string): number {
  const m = court.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

export function formatGameTime(dateStr: string): string {
  try {
    const d = parseScheduleDateTime(dateStr);
    const h = d.getHours();
    const min = d.getMinutes();
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hour12 = h % 12 || 12;
    const minStr = min.toString().padStart(2, '0');
    return `${hour12}:${minStr} ${ampm}`;
  } catch {
    const m = dateStr.match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
    if (m) return `${m[1]}:${m[2]} ${m[3].toUpperCase()}`;
    return dateStr;
  }
}

export function groupPhaseGames(rows: ScheduleRow[]): ScheduleRow[] {
  return rows.filter((r) => r.phase.trim().toLowerCase() === GROUP_PHASE);
}

export function nextAssignment(
  team: string,
  round: number,
  groupGames: ScheduleRow[]
): string {
  if (round > MAX_GROUP_ROUND) return 'Bracket';

  for (const g of groupGames) {
    if (parseInt(g.round, 10) !== round) continue;
    const courtNum = courtNumberFromLabel(g.court);
    const home = cleanTeamName(g.homeTeam);
    const away = cleanTeamName(g.awayTeam);
    const ref = cleanTeamName(g.referees);

    if (home === team || away === team) return `Court ${courtNum}`;
    if (ref === team) return `Ref Court ${courtNum}`;
  }
  return 'OFF';
}

export function buildScoresheetCards(csvText: string): ScoresheetCard[] {
  const groupGames = groupPhaseGames(parseTournamentCsv(csvText));
  const cards: ScoresheetCard[] = [];

  for (const g of groupGames) {
    const round = parseInt(g.round, 10);
    const courtNum = courtNumberFromLabel(g.court);
    const home = cleanTeamName(g.homeTeam);
    const away = cleanTeamName(g.awayTeam);
    const ref = cleanTeamName(g.referees);
    if (!home || !away || !round) continue;

    const nextRound = round + 1;
    const homeWhereNext =
      round >= MAX_GROUP_ROUND ? 'Bracket' : nextAssignment(home, nextRound, groupGames);
    const awayWhereNext =
      round >= MAX_GROUP_ROUND ? 'Bracket' : nextAssignment(away, nextRound, groupGames);
    const refWhereNext =
      round >= MAX_GROUP_ROUND
        ? 'Bracket'
        : ref
          ? nextAssignment(ref, nextRound, groupGames)
          : 'OFF';

    cards.push({
      court: courtNum,
      courtLabel: g.court,
      round,
      time: formatGameTime(g.date),
      ref,
      homeTeam: home,
      awayTeam: away,
      homeWhereNext,
      awayWhereNext,
      refWhereNext,
    });
  }

  cards.sort((a, b) => a.court - b.court || a.round - b.round);
  return cards;
}

export function filterCardsByCourt(
  cards: ScoresheetCard[],
  court: number | null
): ScoresheetCard[] {
  if (court === null) return cards;
  return cards.filter((c) => c.court === court);
}

export function uniqueCourts(cards: ScoresheetCard[]): number[] {
  return [...new Set(cards.map((c) => c.court))].sort((a, b) => a - b);
}

function cardToRows(card: ScoresheetCard): string[][] {
  return [
    [card.courtLabel],
    ['Round', String(card.round), card.time],
    [`Ref: ${card.ref}`, `Next: ${card.refWhereNext}`],
    [card.homeTeam, card.awayTeam],
    ['Score', 'Score'],
    ['', ''],
    [`Where to next: ${card.homeWhereNext}`, `Where to next: ${card.awayWhereNext}`],
    ['Comments:'],
    [''],
    ['Penalties or cards:'],
    [''],
    ['Signatures', 'Signatures'],
    ['Player:', 'Player:'],
  ];
}

export function buildScoresheetsWorkbook(csvText: string): XLSX.WorkBook {
  const cards = buildScoresheetCards(csvText);
  const wb = XLSX.utils.book_new();

  for (const courtNum of uniqueCourts(cards)) {
    const courtCards = cards.filter((c) => c.court === courtNum);
    const allRows: string[][] = [];
    for (let i = 0; i < courtCards.length; i++) {
      if (i > 0) allRows.push([]);
      allRows.push(...cardToRows(courtCards[i]));
    }
    const ws = XLSX.utils.aoa_to_sheet(allRows);
    XLSX.utils.book_append_sheet(wb, ws, `Scoresheets Court ${courtNum}`);
  }

  return wb;
}

export function buildScoresheetsBuffer(csvText: string): Buffer {
  const wb = buildScoresheetsWorkbook(csvText);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}
