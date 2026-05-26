import { splitCsvLine } from './scheduleParser';

export const GENERIC_CLIP_SLUGS = [
  'court_1',
  'court_2',
  'court_3',
  'court_4',
  'vs',
  'head_to_courts',
  'match_soon',
  'round_start',
  'two_minutes',
  'ninety_seconds',
  'one_minute',
  'thirty_seconds',
  'twenty_seconds',
  'no_blocking_countdown',
  'buzzer',
  'playoff_match',
] as const;

/** Group-phase teams for Throw Down 5 (known names). */
export const TEAM_SLUGS = [
  'black-panther',
  'proud-family',
  'fresh-prince',
  'family-matters',
  'abbott-elementary',
  'fillmore',
  'thats-so-raven',
  'smart-guy',
  'the-boondocks',
  'kenan-and-kel',
  'the-cleveland-show',
  'the-parkers',
  'sister-sister',
  'static-shock',
  'martin',
  'the-incredibles',
] as const;

export type GenericClipSlug = (typeof GENERIC_CLIP_SLUGS)[number];
export type TeamSlug = (typeof TEAM_SLUGS)[number];

export type ClipCategory = 'teams' | 'generic';

export interface ClipRef {
  category: ClipCategory;
  slug: string;
}

export function clipKey(ref: ClipRef): string {
  return `${ref.category}/${ref.slug}`;
}

export function parseClipKey(key: string): ClipRef {
  const [category, ...rest] = key.split('/');
  const slug = rest.join('/');
  if (category !== 'teams' && category !== 'generic') {
    throw new Error(`Invalid clip key: ${key}`);
  }
  return { category, slug };
}

export interface ScheduleRow {
  date: string;
  court: string;
  phase: string;
  division: string;
  group: string;
  round: string;
  homeTeam: string;
  awayTeam: string;
  referees: string;
  endTime: string;
}

export interface TimeSlot {
  startMs: number;
  endMs: number;
  durationMs: number;
  round: string;
  phase: string;
  matches: ScheduleRow[];
  hasPlaceholderTeams: boolean;
}

export interface AudioEvent {
  /** Milliseconds from tournament start (first slot). */
  absoluteMs: number;
  clips: ClipRef[];
  label: string;
  slotRound: string;
}

const COURT_ASSIGN_OFFSET_MS = 90_000;
const MATCH_SOON_OFFSET_MS = 30_000;

const WARNING_OFFSETS: { offsetMs: number; slug: GenericClipSlug; label: string }[] = [
  { offsetMs: 120_000, slug: 'two_minutes', label: '2 minutes until no blocking' },
  { offsetMs: 90_000, slug: 'ninety_seconds', label: '90 seconds until no blocking' },
  { offsetMs: 60_000, slug: 'one_minute', label: '1 minute until no blocking' },
  { offsetMs: 30_000, slug: 'thirty_seconds', label: '30 seconds until no blocking' },
  { offsetMs: 20_000, slug: 'twenty_seconds', label: '20 seconds until no blocking' },
  { offsetMs: 10_000, slug: 'no_blocking_countdown', label: 'No blocking countdown' },
];

export function teamNameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function isPlaceholderTeam(name: string): boolean {
  const t = name.trim();
  if (!t || t === 'undefined') return true;
  return (
    /^seed\s*#/i.test(t) ||
    /^winner\s+of/i.test(t) ||
    /^loser\s+of/i.test(t) ||
    /comp mixed/i.test(t)
  );
}

/** Parse schedule datetime strings from throwdown CSV. */
export function parseScheduleDateTime(value: string, reference?: Date): Date {
  const trimmed = value.trim();
  const withYear = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):(\d{2})(?:\s*(am|pm))?$/i
  );
  if (withYear) {
    const [, y, mo, d, h, min, ampm] = withYear;
    let hour = parseInt(h, 10);
    const minute = parseInt(min, 10);
    if (ampm) {
      const lower = ampm.toLowerCase();
      if (lower === 'pm' && hour < 12) hour += 12;
      if (lower === 'am' && hour === 12) hour = 0;
    } else if (reference) {
      const refHour = reference.getHours();
      if (refHour >= 12 && hour < 12) hour += 12;
    }
    return new Date(parseInt(y, 10), parseInt(mo, 10) - 1, parseInt(d, 10), hour, minute, 0);
  }
  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) return new Date(parsed);
  throw new Error(`Could not parse date: ${value}`);
}

export function parseTournamentCsv(csvText: string): ScheduleRow[] {
  const lines = csvText.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];

  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.findIndex((h) => h.includes(name));

  const dateIdx = idx('date');
  const courtIdx = idx('court');
  const phaseIdx = idx('phase');
  const divisionIdx = idx('division');
  const groupIdx = idx('group');
  const roundIdx = idx('round');
  const homeIdx = idx('home team');
  const awayIdx = idx('away team');
  const refIdx = idx('referee');
  const endIdx = idx('end time');

  const rows: ScheduleRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]);
    const get = (n: number) => (n >= 0 ? cells[n]?.trim() ?? '' : '');
    rows.push({
      date: get(dateIdx),
      court: get(courtIdx),
      phase: get(phaseIdx),
      division: get(divisionIdx),
      group: get(groupIdx),
      round: get(roundIdx),
      homeTeam: get(homeIdx),
      awayTeam: get(awayIdx),
      referees: get(refIdx),
      endTime: get(endIdx),
    });
  }
  return rows;
}

function courtNumberFromLabel(court: string): number | null {
  const m = court.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function teamClipRef(teamName: string): ClipRef {
  if (isPlaceholderTeam(teamName)) {
    return { category: 'generic', slug: 'playoff_match' };
  }
  return { category: 'teams', slug: teamNameToSlug(teamName) };
}

export function buildTimeSlots(rows: ScheduleRow[]): TimeSlot[] {
  const byDate = new Map<string, ScheduleRow[]>();
  for (const row of rows) {
    if (!row.date) continue;
    const list = byDate.get(row.date) ?? [];
    list.push(row);
    byDate.set(row.date, list);
  }

  const sortedDates = [...byDate.keys()].sort((a, b) => {
    const da = parseScheduleDateTime(a);
    const db = parseScheduleDateTime(b);
    return da.getTime() - db.getTime();
  });

  if (sortedDates.length === 0) return [];

  const tournamentStart = parseScheduleDateTime(sortedDates[0]);
  const slots: TimeSlot[] = [];

  for (const dateKey of sortedDates) {
    const matches = byDate.get(dateKey) ?? [];
    const start = parseScheduleDateTime(dateKey, tournamentStart);
    const startMs = start.getTime() - tournamentStart.getTime();

    let endMs = startMs;
    for (const m of matches) {
      if (m.endTime) {
        try {
          const end = parseScheduleDateTime(m.endTime, start);
          endMs = Math.max(endMs, end.getTime() - tournamentStart.getTime());
        } catch {
          /* use default duration */
        }
      }
    }
    if (endMs <= startMs) {
      endMs = startMs + 25 * 60 * 1000;
    }

    const hasPlaceholderTeams = matches.some(
      (m) => isPlaceholderTeam(m.homeTeam) || isPlaceholderTeam(m.awayTeam)
    );

    slots.push({
      startMs,
      endMs,
      durationMs: endMs - startMs,
      round: matches[0]?.round ?? '',
      phase: matches[0]?.phase ?? '',
      matches: matches.sort((a, b) => {
        const ca = courtNumberFromLabel(a.court) ?? 0;
        const cb = courtNumberFromLabel(b.court) ?? 0;
        return ca - cb;
      }),
      hasPlaceholderTeams,
    });
  }

  return slots;
}

function courtAssignmentClips(matches: ScheduleRow[]): ClipRef[] {
  const clips: ClipRef[] = [];
  for (const m of matches) {
    const courtNum = courtNumberFromLabel(m.court);
    if (courtNum != null && courtNum >= 1 && courtNum <= 4) {
      clips.push({ category: 'generic', slug: `court_${courtNum}` as GenericClipSlug });
    }
    clips.push(teamClipRef(m.homeTeam));
    clips.push({ category: 'generic', slug: 'vs' });
    clips.push(teamClipRef(m.awayTeam));
  }
  clips.push({ category: 'generic', slug: 'head_to_courts' });
  return clips;
}

export function buildAudioEvents(slots: TimeSlot[]): AudioEvent[] {
  const events: AudioEvent[] = [];

  for (const slot of slots) {
    const { startMs, durationMs, round, matches } = slot;
    const roundLabel = `Round ${round}`;

    const courtAssignMs = Math.max(0, startMs - COURT_ASSIGN_OFFSET_MS);
    events.push({
      absoluteMs: courtAssignMs,
      clips: courtAssignmentClips(matches),
      label: `${roundLabel} — court assignments`,
      slotRound: round,
    });

    const matchSoonMs = Math.max(0, startMs - MATCH_SOON_OFFSET_MS);
    events.push({
      absoluteMs: matchSoonMs,
      clips: [{ category: 'generic', slug: 'match_soon' }],
      label: `${roundLabel} — match soon`,
      slotRound: round,
    });

    events.push({
      absoluteMs: startMs,
      clips: [{ category: 'generic', slug: 'round_start' }],
      label: `${roundLabel} — round start`,
      slotRound: round,
    });

    for (const w of WARNING_OFFSETS) {
      const eventMs = startMs + durationMs - w.offsetMs;
      if (eventMs > startMs) {
        events.push({
          absoluteMs: eventMs,
          clips: [{ category: 'generic', slug: w.slug }],
          label: `${roundLabel} — ${w.label}`,
          slotRound: round,
        });
      }
    }

    events.push({
      absoluteMs: startMs + durationMs,
      clips: [{ category: 'generic', slug: 'buzzer' }],
      label: `${roundLabel} — buzzer`,
      slotRound: round,
    });
  }

  events.sort((a, b) => a.absoluteMs - b.absoluteMs);
  return events;
}

export function getRequiredClipKeys(): string[] {
  const keys = new Set<string>();
  for (const slug of GENERIC_CLIP_SLUGS) {
    keys.add(clipKey({ category: 'generic', slug }));
  }
  for (const slug of TEAM_SLUGS) {
    keys.add(clipKey({ category: 'teams', slug }));
  }
  return [...keys].sort();
}

export function getUniqueClipKeysFromEvents(events: AudioEvent[]): string[] {
  const keys = new Set<string>();
  for (const e of events) {
    for (const c of e.clips) {
      keys.add(clipKey(c));
    }
  }
  return [...keys].sort();
}

export function formatMsFromStart(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function getTournamentDurationMs(slots: TimeSlot[]): number {
  if (slots.length === 0) return 0;
  return Math.max(...slots.map((s) => s.endMs)) + 60_000;
}
