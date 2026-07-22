export const EVENT_TYPES = {
  tournament: 'Tournament',
  open_gym: 'Open gym',
  other: 'Other',
} as const

export type EventType = keyof typeof EVENT_TYPES

export const REGISTRATION_STATUS = {
  registered: 'Registered',
} as const

export type RegistrationStatus = keyof typeof REGISTRATION_STATUS

export type EventRecord = {
  id: string
  name: string
  eventDate: string
  eventType: string
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

export type EventListItem = {
  id: string
  name: string
  eventDate: string
  eventType: string
  eventTypeLabel: string
  notes: string | null
  registrationCount: number
}

export type EventRegistrationListItem = {
  id: string
  eventId: string
  playerId: string
  status: string
  draftGroup: number | null
  isCaptain: boolean
  registeredAt: Date
  updatedAt: Date
  firstName: string
  lastName: string
  rosterName: string
  nickname: string
  jerseyNumber: number | null
  skillLevel: number | null
  skillLabel: string
  gender: string | null
  genderLabel: string
  genderGroupLabel: string
  primaryEmail: string | null
  hasStrongPersonality: boolean
  strongPersonalityNotes: string | null
}

export function isValidEventType(value: unknown): value is EventType {
  return value === 'tournament' || value === 'open_gym' || value === 'other'
}

export function eventTypeLabel(type: string | null | undefined): string {
  if (type && isValidEventType(type)) return EVENT_TYPES[type]
  return EVENT_TYPES.other
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
