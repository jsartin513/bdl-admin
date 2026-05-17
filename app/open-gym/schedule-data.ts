/**
 * Open Gym schedule data, derived from Open Gym Schedules.xlsx via open_gym_schedules.py.
 *
 * Standard schedules (2–5 team) group games by Section.
 * The 6-team schedule has two variants:
 *   - "by section": groups by rotation section (contiguous matchups)
 *   - "waves": interleaved so all team pairs meet sooner (recommended)
 */

export interface Game {
  round: string
  home: string
  away: string
  /** Section number — only present in the 6-team waves variant. */
  section?: number
}

export interface ScheduleSection {
  label: string
  games: Game[]
}

export interface Schedule {
  key: string
  label: string
  /** Whether to show a "Section" column (6-team waves only). */
  showSectionCol?: boolean
  sections: ScheduleSection[]
}

// ── 2-team ────────────────────────────────────────────────────────────────

export const SCHEDULE_2TEAM: Schedule = {
  key: '2team',
  label: '2-Team',
  sections: [
    {
      label: 'Section 1',
      games: [
        { round: 'Rd 1', home: 'Team 1', away: 'Team 2' },
        { round: 'Rd 2', home: 'Team 2', away: 'Team 1' },
        { round: 'Rd 3', home: 'Team 1', away: 'Team 2' },
        { round: 'Rd 4', home: 'Team 2', away: 'Team 1' },
        { round: 'Rd 5', home: 'Team 1', away: 'Team 2' },
        { round: 'Rd 6', home: 'Team 2', away: 'Team 1' },
        { round: 'Rd 7', home: 'Team 1', away: 'Team 2' },
        { round: 'Rd 8', home: 'Team 2', away: 'Team 1' },
      ],
    },
    {
      label: 'Section 2',
      games: [
        { round: 'Rd 9',  home: 'Team 1', away: 'Team 2' },
        { round: 'Rd 10', home: 'Team 2', away: 'Team 1' },
        { round: 'Rd 11', home: 'Team 1', away: 'Team 2' },
        { round: 'Rd 12', home: 'Team 2', away: 'Team 1' },
        { round: 'Rd 13', home: 'Team 1', away: 'Team 2' },
        { round: 'Rd 14', home: 'Team 2', away: 'Team 1' },
        { round: 'Rd 15', home: 'Team 1', away: 'Team 2' },
        { round: 'Rd 16', home: 'Team 2', away: 'Team 1' },
      ],
    },
  ],
}

// ── 3-team ────────────────────────────────────────────────────────────────

export const SCHEDULE_3TEAM: Schedule = {
  key: '3team',
  label: '3-Team',
  sections: [
    {
      label: 'Section 1',
      games: [
        { round: 'Rd 1',  home: 'Team 2', away: 'Team 1' },
        { round: 'Rd 2',  home: 'Team 3', away: 'Team 2' },
        { round: 'Rd 3',  home: 'Team 1', away: 'Team 3' },
        { round: 'Rd 4',  home: 'Team 2', away: 'Team 1' },
        { round: 'Rd 5',  home: 'Team 3', away: 'Team 2' },
        { round: 'Rd 6',  home: 'Team 1', away: 'Team 3' },
        { round: 'Rd 7',  home: 'Team 2', away: 'Team 1' },
        { round: 'Rd 8',  home: 'Team 3', away: 'Team 2' },
        { round: 'Rd 9',  home: 'Team 1', away: 'Team 3' },
        { round: 'Rd 10', home: 'Team 2', away: 'Team 1' },
        { round: 'Rd 11', home: 'Team 3', away: 'Team 2' },
        { round: 'Rd 12', home: 'Team 1', away: 'Team 3' },
      ],
    },
    {
      label: 'Section 2',
      games: [
        { round: 'Rd 13', home: 'Team 3', away: 'Team 1' },
        { round: 'Rd 14', home: 'Team 2', away: 'Team 3' },
        { round: 'Rd 15', home: 'Team 1', away: 'Team 2' },
        { round: 'Rd 16', home: 'Team 3', away: 'Team 1' },
        { round: 'Rd 17', home: 'Team 2', away: 'Team 3' },
        { round: 'Rd 18', home: 'Team 1', away: 'Team 2' },
        { round: 'Rd 19', home: 'Team 3', away: 'Team 1' },
        { round: 'Rd 20', home: 'Team 2', away: 'Team 3' },
        { round: 'Rd 21', home: 'Team 1', away: 'Team 2' },
        { round: 'Rd 22', home: 'Team 3', away: 'Team 1' },
        { round: 'Rd 23', home: 'Team 2', away: 'Team 3' },
        { round: 'Rd 24', home: 'Team 1', away: 'Team 2' },
      ],
    },
  ],
}

// ── 4-team ────────────────────────────────────────────────────────────────

const SECTIONS_4TEAM_LONG: ScheduleSection[] = [
  {
    label: 'Section 1',
    games: [
      { round: 'Rd 1', home: 'Team 1', away: 'Team 2' },
      { round: 'Rd 2', home: 'Team 3', away: 'Team 4' },
      { round: 'Rd 3', home: 'Team 2', away: 'Team 1' },
      { round: 'Rd 4', home: 'Team 4', away: 'Team 3' },
      { round: 'Rd 5', home: 'Team 1', away: 'Team 2' },
      { round: 'Rd 6', home: 'Team 3', away: 'Team 4' },
      { round: 'Rd 7', home: 'Team 2', away: 'Team 1' },
      { round: 'Rd 8', home: 'Team 4', away: 'Team 3' },
    ],
  },
  {
    label: 'Section 2',
    games: [
      { round: 'Rd 1', home: 'Team 2', away: 'Team 3' },
      { round: 'Rd 2', home: 'Team 1', away: 'Team 4' },
      { round: 'Rd 3', home: 'Team 3', away: 'Team 2' },
      { round: 'Rd 4', home: 'Team 4', away: 'Team 1' },
      { round: 'Rd 5', home: 'Team 2', away: 'Team 3' },
      { round: 'Rd 6', home: 'Team 1', away: 'Team 4' },
      { round: 'Rd 7', home: 'Team 3', away: 'Team 2' },
      { round: 'Rd 8', home: 'Team 4', away: 'Team 1' },
    ],
  },
  {
    label: 'Section 3',
    games: [
      { round: 'Rd 1', home: 'Team 4', away: 'Team 2' },
      { round: 'Rd 2', home: 'Team 3', away: 'Team 1' },
      { round: 'Rd 3', home: 'Team 2', away: 'Team 4' },
      { round: 'Rd 4', home: 'Team 1', away: 'Team 3' },
      { round: 'Rd 5', home: 'Team 4', away: 'Team 2' },
      { round: 'Rd 6', home: 'Team 3', away: 'Team 1' },
      { round: 'Rd 7', home: 'Team 2', away: 'Team 4' },
      { round: 'Rd 8', home: 'Team 1', away: 'Team 3' },
    ],
  },
]

export const SCHEDULE_4TEAM_LONG: Schedule = {
  key: '4team_long',
  label: '4-Team Long',
  sections: SECTIONS_4TEAM_LONG,
}

export const SCHEDULE_4TEAM_SHORT: Schedule = {
  key: '4team_short',
  label: '4-Team Short',
  sections: SECTIONS_4TEAM_LONG.map((s) => ({
    ...s,
    games: s.games.slice(0, 4),
  })),
}

// ── 5-team ────────────────────────────────────────────────────────────────

const SECTIONS_5TEAM_LONG: ScheduleSection[] = [
  {
    label: 'Section 1',
    games: [
      { round: 'Rd 1',  home: 'Team 1', away: 'Team 2' },
      { round: 'Rd 2',  home: 'Team 3', away: 'Team 4' },
      { round: 'Rd 3',  home: 'Team 5', away: 'Team 1' },
      { round: 'Rd 4',  home: 'Team 2', away: 'Team 3' },
      { round: 'Rd 5',  home: 'Team 4', away: 'Team 5' },
      { round: 'Rd 6',  home: 'Team 1', away: 'Team 2' },
      { round: 'Rd 7',  home: 'Team 3', away: 'Team 4' },
      { round: 'Rd 8',  home: 'Team 5', away: 'Team 1' },
      { round: 'Rd 9',  home: 'Team 2', away: 'Team 3' },
      { round: 'Rd 10', home: 'Team 4', away: 'Team 5' },
    ],
  },
  {
    label: 'Section 2',
    games: [
      { round: 'Rd 1',  home: 'Team 3', away: 'Team 5' },
      { round: 'Rd 2',  home: 'Team 4', away: 'Team 2' },
      { round: 'Rd 3',  home: 'Team 1', away: 'Team 3' },
      { round: 'Rd 4',  home: 'Team 5', away: 'Team 2' },
      { round: 'Rd 5',  home: 'Team 4', away: 'Team 1' },
      { round: 'Rd 6',  home: 'Team 3', away: 'Team 5' },
      { round: 'Rd 7',  home: 'Team 2', away: 'Team 4' },
      { round: 'Rd 8',  home: 'Team 1', away: 'Team 3' },
      { round: 'Rd 9',  home: 'Team 5', away: 'Team 2' },
      { round: 'Rd 10', home: 'Team 4', away: 'Team 1' },
    ],
  },
  {
    label: 'Section 3',
    games: [
      { round: 'Rd 1',  home: 'Team 2', away: 'Team 3' },
      { round: 'Rd 2',  home: 'Team 4', away: 'Team 5' },
      { round: 'Rd 3',  home: 'Team 1', away: 'Team 2' },
      { round: 'Rd 4',  home: 'Team 3', away: 'Team 4' },
      { round: 'Rd 5',  home: 'Team 5', away: 'Team 1' },
      { round: 'Rd 6',  home: 'Team 2', away: 'Team 3' },
      { round: 'Rd 7',  home: 'Team 4', away: 'Team 5' },
      { round: 'Rd 8',  home: 'Team 1', away: 'Team 2' },
      { round: 'Rd 9',  home: 'Team 3', away: 'Team 4' },
      { round: 'Rd 10', home: 'Team 5', away: 'Team 1' },
    ],
  },
]

export const SCHEDULE_5TEAM_LONG: Schedule = {
  key: '5team_long',
  label: '5-Team Long',
  sections: SECTIONS_5TEAM_LONG,
}

export const SCHEDULE_5TEAM_SHORT: Schedule = {
  key: '5team_short',
  label: '5-Team Short',
  sections: SECTIONS_5TEAM_LONG.map((s) => ({
    ...s,
    games: s.games.slice(0, 5),
  })),
}

// ── 6-team ────────────────────────────────────────────────────────────────

export const SCHEDULE_6TEAM_BY_SECTION: Schedule = {
  key: '6team_by_section',
  label: '6-Team — By Section',
  sections: [
    {
      label: 'Section 1',
      games: [
        { round: 'Rd 1', home: 'Team 1', away: 'Team 2' },
        { round: 'Rd 2', home: 'Team 3', away: 'Team 4' },
        { round: 'Rd 3', home: 'Team 5', away: 'Team 6' },
        { round: 'Rd 4', home: 'Team 2', away: 'Team 1' },
        { round: 'Rd 5', home: 'Team 4', away: 'Team 3' },
        { round: 'Rd 6', home: 'Team 6', away: 'Team 5' },
      ],
    },
    {
      label: 'Section 2',
      games: [
        { round: 'Rd 1', home: 'Team 2', away: 'Team 4' },
        { round: 'Rd 2', home: 'Team 3', away: 'Team 5' },
        { round: 'Rd 3', home: 'Team 1', away: 'Team 6' },
        { round: 'Rd 4', home: 'Team 4', away: 'Team 2' },
        { round: 'Rd 5', home: 'Team 5', away: 'Team 3' },
        { round: 'Rd 6', home: 'Team 6', away: 'Team 1' },
      ],
    },
    {
      label: 'Section 3',
      games: [
        { round: 'Rd 1', home: 'Team 3', away: 'Team 6' },
        { round: 'Rd 2', home: 'Team 1', away: 'Team 4' },
        { round: 'Rd 3', home: 'Team 2', away: 'Team 5' },
        { round: 'Rd 4', home: 'Team 6', away: 'Team 3' },
        { round: 'Rd 5', home: 'Team 4', away: 'Team 1' },
        { round: 'Rd 6', home: 'Team 5', away: 'Team 2' },
      ],
    },
    {
      label: 'Section 4',
      games: [
        { round: 'Rd 1', home: 'Team 4', away: 'Team 5' },
        { round: 'Rd 2', home: 'Team 1', away: 'Team 3' },
        { round: 'Rd 3', home: 'Team 2', away: 'Team 6' },
        { round: 'Rd 4', home: 'Team 5', away: 'Team 4' },
        { round: 'Rd 5', home: 'Team 3', away: 'Team 1' },
        { round: 'Rd 6', home: 'Team 6', away: 'Team 2' },
      ],
    },
    {
      label: 'Section 5',
      games: [
        { round: 'Rd 1', home: 'Team 4', away: 'Team 6' },
        { round: 'Rd 2', home: 'Team 1', away: 'Team 5' },
        { round: 'Rd 3', home: 'Team 2', away: 'Team 3' },
        { round: 'Rd 4', home: 'Team 6', away: 'Team 4' },
        { round: 'Rd 5', home: 'Team 5', away: 'Team 1' },
        { round: 'Rd 6', home: 'Team 3', away: 'Team 2' },
      ],
    },
  ],
}

export const SCHEDULE_6TEAM_WAVES: Schedule = {
  key: '6team_waves',
  label: '6-Team — Waves',
  showSectionCol: true,
  sections: [
    {
      label: 'Wave 1',
      games: [
        { section: 1, round: 'Rd 1', home: 'Team 1', away: 'Team 2' },
        { section: 2, round: 'Rd 1', home: 'Team 2', away: 'Team 4' },
        { section: 3, round: 'Rd 1', home: 'Team 3', away: 'Team 6' },
        { section: 4, round: 'Rd 1', home: 'Team 4', away: 'Team 5' },
        { section: 5, round: 'Rd 1', home: 'Team 4', away: 'Team 6' },
      ],
    },
    {
      label: 'Wave 2',
      games: [
        { section: 1, round: 'Rd 2', home: 'Team 3', away: 'Team 4' },
        { section: 2, round: 'Rd 2', home: 'Team 3', away: 'Team 5' },
        { section: 3, round: 'Rd 2', home: 'Team 1', away: 'Team 4' },
        { section: 4, round: 'Rd 2', home: 'Team 1', away: 'Team 3' },
        { section: 5, round: 'Rd 2', home: 'Team 1', away: 'Team 5' },
      ],
    },
    {
      label: 'Wave 3',
      games: [
        { section: 1, round: 'Rd 3', home: 'Team 5', away: 'Team 6' },
        { section: 2, round: 'Rd 3', home: 'Team 1', away: 'Team 6' },
        { section: 3, round: 'Rd 3', home: 'Team 2', away: 'Team 5' },
        { section: 4, round: 'Rd 3', home: 'Team 2', away: 'Team 6' },
        { section: 5, round: 'Rd 3', home: 'Team 2', away: 'Team 3' },
      ],
    },
    {
      label: 'Wave 4',
      games: [
        { section: 1, round: 'Rd 4', home: 'Team 2', away: 'Team 1' },
        { section: 2, round: 'Rd 4', home: 'Team 4', away: 'Team 2' },
        { section: 3, round: 'Rd 4', home: 'Team 6', away: 'Team 3' },
        { section: 4, round: 'Rd 4', home: 'Team 5', away: 'Team 4' },
        { section: 5, round: 'Rd 4', home: 'Team 6', away: 'Team 4' },
      ],
    },
    {
      label: 'Wave 5',
      games: [
        { section: 1, round: 'Rd 5', home: 'Team 4', away: 'Team 3' },
        { section: 2, round: 'Rd 5', home: 'Team 5', away: 'Team 3' },
        { section: 3, round: 'Rd 5', home: 'Team 4', away: 'Team 1' },
        { section: 4, round: 'Rd 5', home: 'Team 3', away: 'Team 1' },
        { section: 5, round: 'Rd 5', home: 'Team 5', away: 'Team 1' },
      ],
    },
    {
      label: 'Wave 6',
      games: [
        { section: 1, round: 'Rd 6', home: 'Team 6', away: 'Team 5' },
        { section: 2, round: 'Rd 6', home: 'Team 6', away: 'Team 1' },
        { section: 3, round: 'Rd 6', home: 'Team 5', away: 'Team 2' },
        { section: 4, round: 'Rd 6', home: 'Team 6', away: 'Team 2' },
        { section: 5, round: 'Rd 6', home: 'Team 3', away: 'Team 2' },
      ],
    },
  ],
}

// ── Lookup by numTeams ────────────────────────────────────────────────────

export const SCHEDULES_BY_TEAM_COUNT: Record<number, { schedules: Schedule[] }> = {
  2: { schedules: [SCHEDULE_2TEAM] },
  3: { schedules: [SCHEDULE_3TEAM] },
  4: { schedules: [SCHEDULE_4TEAM_SHORT, SCHEDULE_4TEAM_LONG] },
  5: { schedules: [SCHEDULE_5TEAM_SHORT, SCHEDULE_5TEAM_LONG] },
  6: { schedules: [SCHEDULE_6TEAM_WAVES, SCHEDULE_6TEAM_BY_SECTION] },
}
