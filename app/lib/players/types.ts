export type ChangeSource = 'import' | 'admin' | 'webapp'
export type ChangeType = 'create' | 'update' | 'merge' | 'import'

export type PlayerSnapshot = {
  id: string
  firstName: string
  lastName: string
  rosterName: string
  jerseyNumber: number | null
  skillLevel: number | null
  isMerged: boolean
  mergedIntoPlayerId: string | null
  emails: { id: string; email: string; isPrimary: boolean }[]
  aliases: { id: string; alias: string }[]
}

export type PlayerListItem = {
  id: string
  firstName: string
  lastName: string
  rosterName: string
  jerseyNumber: number | null
  skillLevel: number | null
  skillLabel: string
  primaryEmail: string | null
  isMerged: boolean
}
