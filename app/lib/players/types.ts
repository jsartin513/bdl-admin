export type ChangeSource = 'import' | 'admin' | 'webapp'
export type ChangeType = 'create' | 'update' | 'merge' | 'unmerge' | 'import'

export type PlayerSnapshot = {
  id: string
  firstName: string
  lastName: string
  rosterName: string
  /** Effective nickname (custom or first + last initial). */
  nickname: string
  /** Stored custom nickname; null means still using the default. */
  nicknameCustom: string | null
  jerseyNumber: number | null
  /** Effective jersey name (custom or last name). */
  jerseyName: string
  /** Stored custom jersey name; null means still using last name. */
  jerseyNameCustom: string | null
  skillLevel: number | null
  gender: string | null
  isMerged: boolean
  mergedIntoPlayerId: string | null
  hasStrongPersonality: boolean
  strongPersonalityNotes: string | null
  emails: { id: string; email: string; isPrimary: boolean }[]
  aliases: { id: string; alias: string }[]
  homeLeagues: { id: string; homeLeague: string; label: string; sortOrder: number }[]
}

export type PlayerListItem = {
  id: string
  firstName: string
  lastName: string
  rosterName: string
  nickname: string
  jerseyNumber: number | null
  jerseyName: string
  skillLevel: number | null
  skillLabel: string
  gender: string | null
  genderLabel: string
  genderGroupLabel: string
  primaryEmail: string | null
  isMerged: boolean
  hasStrongPersonality: boolean
  strongPersonalityNotes: string | null
  homeLeagues: { homeLeague: string; label: string }[]
}
