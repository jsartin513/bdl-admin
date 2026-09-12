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
  skillLevelFib: number | null
  skillAreas: {
    offense: number | null
    defense: number | null
    stayingAlive: number | null
    courtPresence: number | null
  } | null
  gender: string | null
  photoUrl: string | null
  photoPathname: string | null
  isMerged: boolean
  mergedIntoPlayerId: string | null
  hasStrongPersonality: boolean
  strongPersonalityNotes: string | null
  emails: { id: string; email: string; isPrimary: boolean }[]
  phones: { id: string; phoneE164: string; isPrimary: boolean }[]
  aliases: { id: string; alias: string }[]
  homeLeagues: {
    id: string
    homeLeague: string
    label: string
    logoUrl: string | null
    sortOrder: number
  }[]
  messagingPrefs: {
    emailOptOutAt: string | null
    smsOptInAt: string | null
    smsOptOutAt: string | null
    whatsappOptInAt: string | null
    whatsappOptOutAt: string | null
  } | null
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
  skillLevelFib: number | null
  skillAreas: {
    offense: number | null
    defense: number | null
    stayingAlive: number | null
    courtPresence: number | null
  } | null
  skillLabel: string
  gender: string | null
  genderLabel: string
  genderGroupLabel: string
  photoUrl: string | null
  primaryEmail: string | null
  primaryPhone: string | null
  isMerged: boolean
  hasStrongPersonality: boolean
  strongPersonalityNotes: string | null
  homeLeagues: { homeLeague: string; label: string; logoUrl: string | null }[]
}
