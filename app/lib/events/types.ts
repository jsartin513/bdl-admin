export const EVENT_TYPES = {
  tournament: 'Tournament',
  open_gym: 'Open gym',
  other: 'Other',
} as const

export type EventType = keyof typeof EVENT_TYPES

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
  ballType: string
  gender: string
  notes: string | null
  pairingEnabled: boolean
  createdAt: Date
  updatedAt: Date
}

export type EventListItem = {
  id: string
  name: string
  eventDate: string
  eventType: string
  eventTypeLabel: string
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

export type EventRegistrationListItem = {
  id: string
  eventId: string
  playerId: string
  status: string
  draftGroup: number | null
  isCaptain: boolean
  pairId: string | null
  partnerRegistrationId: string | null
  partnerNickname: string | null
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
  return value === 'tournament' || value === 'open_gym' || value === 'other'
}

export function eventTypeLabel(type: string | null | undefined): string {
  if (type && isValidEventType(type)) return EVENT_TYPES[type]
  return EVENT_TYPES.other
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
