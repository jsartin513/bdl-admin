// Shared types for schedule components
export interface Game {
  gameNumber: string
  court1Team1: string
  court1Team2: string
  court1Ref: string
  court2Team1: string
  court2Team2: string
  court2Ref: string
}

export interface MatchupDetail {
  total: number
  home: number
  away: number
}

export interface TeamStats {
  gamesPlayed: number
  gamesReffed: number
  homeGames: number
  awayGames: number
  matchups?: Record<string, MatchupDetail>
}

export interface TeamStatsWithTeam extends TeamStats {
  team: string
  matchups: { [opponent: string]: MatchupDetail }
}

/** Home/away/ref for a single court in one game (used to show only the relevant court per warning) */
export interface ConflictCourtDetail {
  gameNumber: string
  court: 1 | 2
  home: string
  away: string
  ref: string
}

/** One two-court round in a consecutive-without-playing streak: both matchups + how the inactive team is used */
export interface IdleStreakRoundDetail {
  gameNumber: string
  /** Team that did not play on either court this round */
  offTeam: string
  /** e.g. reffing Court 1, reffing Court 2, or fully off */
  offTeamStatus: string
  court1: { home: string; away: string; ref: string }
  court2: { home: string; away: string; ref: string }
}

/** Logical category for grouping in ConflictsAlert (set by parseScheduleCSV when possible). */
export type ConflictType =
  | 'double-court'
  | 'ref-and-play'
  | 'consecutive-ref'
  | 'consecutive-without-playing'
  | 'consecutive-matchup'
  | 'duplicate-orientation-same-night'
  | 'home-away-imbalance'
  | 'unknown'

export interface Conflict {
  gameNumber: string
  team: string
  conflicts: string[]
  /** When set to 'warning', shown as a minor alert (e.g. refs twice in a row); 'alert' for info (e.g. same home/away config repeated) */
  severity?: 'error' | 'warning' | 'alert'
  /** Group collapsible sections by this in the UI */
  conflictType?: ConflictType
  /** For warnings: home/away/ref for only the court involved in this issue, for each game in the pair */
  courtDetails?: ConflictCourtDetail[]
  /** Consecutive-without-playing: full two-court picture per round */
  idleStreakRounds?: IdleStreakRoundDetail[]
}

export type WeekOption =
  | 'all'
  | 'weeks5-6'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'