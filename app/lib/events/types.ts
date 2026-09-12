export const EVENT_TYPES = {
  tournament: 'Tournament',
  league: 'League',
  open_gym: 'Open gym',
  other: 'Other',
} as const

export type EventType = keyof typeof EVENT_TYPES

export const EVENT_FORMATS = {
  byot: 'BYOT',
  remix: 'Remix',
  draft: 'Draft',
} as const

export type EventFormat = keyof typeof EVENT_FORMATS

export const BALL_TYPES = {
  foam: 'Foam',
  cloth: 'Cloth',
} as const

export type BallType = keyof typeof BALL_TYPES

export const EVENT_GENDERS = {
  mixed: 'Mixed',
  open: 'Open',
  she_they: 'She/they',
} as const

export type EventGender = keyof typeof EVENT_GENDERS

export const REGISTRATION_STATUS = {
  registered: 'Registered',
} as const

export type RegistrationStatus = keyof typeof REGISTRATION_STATUS

export type EventRecord = {
  id: string
  name: string
  eventDate: string
  eventType: string
  /** Canonical: byot | remix | draft | null (unset) */
  eventFormat: string | null
  ballType: string
  gender: string
  notes: string | null
  pairingEnabled: boolean
  teamNames: string[]
  teamsLocked: boolean
  teamsFinalizedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type EventListItem = {
  id: string
  name: string
  eventDate: string
  eventType: string
  eventTypeLabel: string
  eventFormat: string | null
  eventFormatLabel: string | null
  ballType: string
  ballTypeLabel: string
  gender: string
  genderLabel: string
  notes: string | null
  registrationCount: number
}

export type EventRegistrationHomeLeague = {
  homeLeague: string
  label: string
  logoUrl: string | null
}

export type EventRegistrationGroupMember = {
  registrationId: string
  nickname: string
}

export type EventRegistrationListItem = {
  id: string
  eventId: string
  playerId: string
  status: string
  draftGroup: number | null
  isCaptain: boolean
  /** BYOT: signup team is locked; cannot move via draft board / bulk apply */
  teamLocked: boolean
  pairId: string | null
  /** For groups of exactly 2; prefer groupMembers for N-person groups */
  partnerRegistrationId: string | null
  partnerNickname: string | null
  /** Other members of the same pairId group (excludes self) */
  groupMembers: EventRegistrationGroupMember[]
  registeredAt: Date
  updatedAt: Date
  firstName: string
  lastName: string
  rosterName: string
  nickname: string
  jerseyNumber: number | null
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
  primaryEmail: string | null
  hasStrongPersonality: boolean
  strongPersonalityNotes: string | null
  homeLeagues: EventRegistrationHomeLeague[]
}

export type EventDraftSnapshotListItem = {
  id: string
  eventId: string
  name: string
  assignments: Record<string, number | null>
  createdAt: Date
  updatedAt: Date
}

export function isValidEventType(value: unknown): value is EventType {
  return (
    value === 'tournament' ||
    value === 'league' ||
    value === 'open_gym' ||
    value === 'other'
  )
}

export function eventTypeLabel(type: string | null | undefined): string {
  if (type && isValidEventType(type)) return EVENT_TYPES[type]
  return EVENT_TYPES.other
}

export function isValidEventFormat(value: unknown): value is EventFormat {
  return value === 'byot' || value === 'remix' || value === 'draft'
}

/** Parse format from API input; empty/null clears. Undefined means omit. */
export function parseEventFormat(
  value: unknown
): EventFormat | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (!isValidEventFormat(value)) {
    throw new Error('Invalid eventFormat')
  }
  return value
}

export function eventFormatLabel(
  format: string | null | undefined
): string | null {
  if (format && isValidEventFormat(format)) return EVENT_FORMATS[format]
  return null
}

export function isValidBallType(value: unknown): value is BallType {
  return value === 'foam' || value === 'cloth'
}

export function ballTypeLabel(type: string | null | undefined): string {
  if (type && isValidBallType(type)) return BALL_TYPES[type]
  return BALL_TYPES.foam
}

export function isValidEventGender(value: unknown): value is EventGender {
  return value === 'mixed' || value === 'open' || value === 'she_they'
}

export function eventGenderLabel(gender: string | null | undefined): string {
  if (gender && isValidEventGender(gender)) return EVENT_GENDERS[gender]
  return EVENT_GENDERS.mixed
}

/** Positive integer draft bucket, or null to clear / unassigned. */
export function parseDraftGroup(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10)
  if (!Number.isInteger(n) || n < 1) {
    throw new Error('draftGroup must be a positive integer or null')
  }
  return n
}

export function isValidDraftGroup(value: unknown): value is number | null {
  try {
    const parsed = parseDraftGroup(value)
    return parsed !== undefined
  } catch {
    return false
  }
}
