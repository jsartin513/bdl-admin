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
  'no_blocking_start',
  'two_minutes',
  'ninety_seconds',
  'one_minute',
  'thirty_seconds',
  'twenty_seconds',
  'no_blocking_countdown',
  'buzzer',
  'playoff_match',
] as const;

/** Generic clips used as countdown warnings before phase markers. */
export const COUNTDOWN_CLIP_SLUGS = [
  'two_minutes',
  'ninety_seconds',
  'one_minute',
  'thirty_seconds',
  'twenty_seconds',
  'no_blocking_countdown',
] as const;

export type CountdownClipSlug = (typeof COUNTDOWN_CLIP_SLUGS)[number];

export const COUNTDOWN_SLUG_SECONDS: Record<CountdownClipSlug, number> = {
  two_minutes: 120,
  ninety_seconds: 90,
  one_minute: 60,
  thirty_seconds: 30,
  twenty_seconds: 20,
  no_blocking_countdown: 10,
};

const COUNTDOWN_SLUG_LABELS: Record<CountdownClipSlug, string> = {
  two_minutes: '2 minutes',
  ninety_seconds: '90 seconds',
  one_minute: '1 minute',
  thirty_seconds: '30 seconds',
  twenty_seconds: '20 seconds',
  no_blocking_countdown: 'No blocking countdown',
};

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

export type ClipCategory = 'teams' | 'generic' | 'matchups' | 'refs';

export type TeamNameMode = 'separate' | 'compound';

export interface ScheduleConfig {
  /** Minutes from round start until no-blocking begins. */
  noBlockingStartMin: number;
  /** Minutes no-blocking lasts before buzzer. */
  noBlockingDurationMin: number;
  /** Ms before round start when court assignments play. */
  courtAssignOffsetMs: number;
  teamNameMode: TeamNameMode;
  includeRefs: boolean;
  countdownsBeforeNoBlockingStart: CountdownClipSlug[];
  countdownsBeforeNoBlockingEnd: CountdownClipSlug[];
  countdownsBeforeCourtCall: CountdownClipSlug[];
}

export const DEFAULT_SCHEDULE_CONFIG: ScheduleConfig = {
  noBlockingStartMin: 15,
  noBlockingDurationMin: 3,
  courtAssignOffsetMs: 90_000,
  teamNameMode: 'separate',
  includeRefs: false,
  countdownsBeforeNoBlockingStart: [
    'two_minutes',
    'ninety_seconds',
    'one_minute',
    'thirty_seconds',
    'twenty_seconds',
    'no_blocking_countdown',
  ],
  countdownsBeforeNoBlockingEnd: [],
  countdownsBeforeCourtCall: [],
};

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
  if (
    category !== 'teams' &&
    category !== 'generic' &&
    category !== 'matchups' &&
    category !== 'refs'
  ) {
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

const MATCH_SOON_OFFSET_MS = 30_000;

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

export function matchupSlug(homeTeam: string, awayTeam: string): string {
  return `${teamNameToSlug(homeTeam)}-vs-${teamNameToSlug(awayTeam)}`;
}

function matchupClipRef(homeTeam: string, awayTeam: string): ClipRef {
  if (isPlaceholderTeam(homeTeam) || isPlaceholderTeam(awayTeam)) {
    return { category: 'generic', slug: 'playoff_match' };
  }
  return { category: 'matchups', slug: matchupSlug(homeTeam, awayTeam) };
}

function refClipRef(refName: string): ClipRef {
  return { category: 'refs', slug: teamNameToSlug(refName) };
}

export function getNoBlockingStartMs(slot: TimeSlot, config: ScheduleConfig): number {
  return slot.startMs + config.noBlockingStartMin * 60_000;
}

export function getNoBlockingEndMs(slot: TimeSlot, config: ScheduleConfig): number {
  return getNoBlockingStartMs(slot, config) + config.noBlockingDurationMin * 60_000;
}

export function getCourtCallMs(slot: TimeSlot, config: ScheduleConfig): number {
  return Math.max(0, slot.startMs - config.courtAssignOffsetMs);
}

export function getNextRoundStartMs(
  slotIndex: number,
  slots: TimeSlot[]
): number | null {
  const next = slots[slotIndex + 1];
  return next ? next.startMs : null;
}

function emitCountdowns(
  events: AudioEvent[],
  markerMs: number,
  slugs: CountdownClipSlug[],
  roundLabel: string,
  slotRound: string,
  minMs: number,
  maxMs: number,
  phaseLabel: string
): void {
  for (const slug of slugs) {
    const secs = COUNTDOWN_SLUG_SECONDS[slug];
    const eventMs = markerMs - secs * 1000;
    if (eventMs >= minMs && eventMs < maxMs) {
      events.push({
        absoluteMs: eventMs,
        clips: [{ category: 'generic', slug }],
        label: `${roundLabel} — ${COUNTDOWN_SLUG_LABELS[slug]} before ${phaseLabel}`,
        slotRound,
      });
    }
  }
}

export function getUniqueMatchupRefsFromSlots(
  slots: TimeSlot[],
  config: ScheduleConfig
): ClipRef[] {
  if (config.teamNameMode !== 'compound') return [];
  const seen = new Set<string>();
  const refs: ClipRef[] = [];
  for (const slot of slots) {
    for (const m of slot.matches) {
      const ref = matchupClipRef(m.homeTeam, m.awayTeam);
      const key = clipKey(ref);
      if (!seen.has(key)) {
        seen.add(key);
        refs.push(ref);
      }
    }
  }
  return refs;
}

export function getUniqueRefRefsFromSlots(slots: TimeSlot[]): ClipRef[] {
  const seen = new Set<string>();
  const refs: ClipRef[] = [];
  for (const slot of slots) {
    for (const m of slot.matches) {
      const name = m.referees.trim();
      if (!name) continue;
      const ref = refClipRef(name);
      const key = clipKey(ref);
      if (!seen.has(key)) {
        seen.add(key);
        refs.push(ref);
      }
    }
  }
  return refs;
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

function courtAssignmentClips(matches: ScheduleRow[], config: ScheduleConfig): ClipRef[] {
  const clips: ClipRef[] = [];
  for (const m of matches) {
    const courtNum = courtNumberFromLabel(m.court);
    if (courtNum != null && courtNum >= 1 && courtNum <= 4) {
      clips.push({ category: 'generic', slug: `court_${courtNum}` as GenericClipSlug });
    }
    if (config.teamNameMode === 'compound') {
      clips.push(matchupClipRef(m.homeTeam, m.awayTeam));
    } else {
      clips.push(teamClipRef(m.homeTeam));
      clips.push({ category: 'generic', slug: 'vs' });
      clips.push(teamClipRef(m.awayTeam));
    }
    if (config.includeRefs && m.referees.trim()) {
      clips.push(refClipRef(m.referees));
    }
  }
  clips.push({ category: 'generic', slug: 'head_to_courts' });
  return clips;
}

export function buildAudioEvents(
  slots: TimeSlot[],
  config: ScheduleConfig = DEFAULT_SCHEDULE_CONFIG
): AudioEvent[] {
  const events: AudioEvent[] = [];

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    const { startMs, round, matches } = slot;
    const roundLabel = `Round ${round}`;

    const courtAssignMs = getCourtCallMs(slot, config);
    const nextCourtCallMs =
      i + 1 < slots.length ? getCourtCallMs(slots[i + 1], config) : Number.POSITIVE_INFINITY;

    emitCountdowns(
      events,
      courtAssignMs,
      config.countdownsBeforeCourtCall,
      roundLabel,
      round,
      0,
      courtAssignMs,
      'court call'
    );

    events.push({
      absoluteMs: courtAssignMs,
      clips: courtAssignmentClips(matches, config),
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

    const noBlockingStartMs = getNoBlockingStartMs(slot, config);
    const noBlockingEndMs = getNoBlockingEndMs(slot, config);

    emitCountdowns(
      events,
      noBlockingStartMs,
      config.countdownsBeforeNoBlockingStart,
      roundLabel,
      round,
      startMs,
      Math.min(noBlockingStartMs, nextCourtCallMs),
      'no blocking'
    );

    events.push({
      absoluteMs: noBlockingStartMs,
      clips: [{ category: 'generic', slug: 'no_blocking_start' }],
      label: `${roundLabel} — no blocking starts`,
      slotRound: round,
    });

    emitCountdowns(
      events,
      noBlockingEndMs,
      config.countdownsBeforeNoBlockingEnd,
      roundLabel,
      round,
      noBlockingStartMs,
      Math.min(noBlockingEndMs, nextCourtCallMs),
      'no blocking ends'
    );

    events.push({
      absoluteMs: noBlockingEndMs,
      clips: [{ category: 'generic', slug: 'buzzer' }],
      label: `${roundLabel} — buzzer (no blocking ends)`,
      slotRound: round,
    });
  }

  return coalesceEventsAtSameTimestamp(events);
}

/** Merge events that share the same timestamp (e.g. first-slot pre-round at t=0). */
export function coalesceEventsAtSameTimestamp(events: AudioEvent[]): AudioEvent[] {
  const sorted = [...events].sort((a, b) => a.absoluteMs - b.absoluteMs);
  const merged: AudioEvent[] = [];

  for (const event of sorted) {
    const last = merged[merged.length - 1];
    if (last && last.absoluteMs === event.absoluteMs) {
      last.clips.push(...event.clips);
      last.label = `${last.label} + ${event.label}`;
      if (!last.slotRound && event.slotRound) last.slotRound = event.slotRound;
    } else {
      merged.push({
        ...event,
        clips: [...event.clips],
      });
    }
  }

  return merged;
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
