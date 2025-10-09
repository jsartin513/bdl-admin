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

export interface Conflict {
  gameNumber: string
  team: string
  conflicts: string[]
}

export type WeekOption = 'all' | '1' | '2' | '3' | '4' | '5' | '6'