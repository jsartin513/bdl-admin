import { parseEventDate } from '@/app/lib/events/mutations'
import {
  isValidBallType,
  isValidEventFormat,
  isValidEventGender,
  isValidEventType,
} from '@/app/lib/events/types'

/** Keys accepted on `PATCH /api/events/[id]` (admin only). */
export const EVENT_UPDATE_PATCH_KEYS = [
  'name',
  'eventDate',
  'eventType',
  'eventFormat',
  'ballType',
  'gender',
  'notes',
  'pairingEnabled',
  'teamNames',
  'teamsLocked',
  'finalizeTeams',
  'publishedToPlayerApp',
  'publicDescription',
  'location',
  'sessionTimeLabel',
  'priceCents',
  'capacity',
  'registrationOpensAt',
  'registrationClosesAt',
  'eventEndDate',
] as const

export type EventUpdatePatchKey = (typeof EVENT_UPDATE_PATCH_KEYS)[number]

export type EventUpdatePatch = {
  name?: string
  eventDate?: string
  eventType?: string | null
  eventFormat?: string | null
  ballType?: string | null
  gender?: string | null
  notes?: string | null
  pairingEnabled?: boolean
  teamNames?: string[]
  teamsLocked?: boolean
  finalizeTeams?: boolean
  publishedToPlayerApp?: boolean
  publicDescription?: string | null
  location?: string | null
  sessionTimeLabel?: string | null
  priceCents?: number | null
  capacity?: number | null
  registrationOpensAt?: Date | null
  registrationClosesAt?: Date | null
  eventEndDate?: string | null
}

const ALLOWED = new Set<string>(EVENT_UPDATE_PATCH_KEYS)

function parseOptionalTrimmedText(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function parseOptionalIsoTimestamp(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (typeof value !== 'string') return undefined
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return undefined
  return d
}

function parseOptionalNonNegativeInt(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    return undefined
  }
  return value
}

function parseOptionalPositiveInt(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    return undefined
  }
  return value
}

function parseOptionalEventEndDate(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (typeof value !== 'string') return undefined
  return parseEventDate(value)
}

/**
 * Parse and validate an event PATCH body. Rejects unknown keys so staff notes and
 * other internal fields cannot be smuggled under alternate names.
 */
export function parseEventUpdatePatch(body: unknown): EventUpdatePatch {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Invalid body')
  }
  const record = body as Record<string, unknown>
  for (const key of Object.keys(record)) {
    if (!ALLOWED.has(key)) {
      throw new Error(`Unknown field: ${key}`)
    }
  }

  const patch: EventUpdatePatch = {}

  if (record.name !== undefined) {
    if (typeof record.name !== 'string') throw new Error('name must be a string')
    patch.name = record.name
  }
  if (record.eventDate !== undefined) {
    if (typeof record.eventDate !== 'string') {
      throw new Error('eventDate must be a string')
    }
    patch.eventDate = record.eventDate
  }
  if (record.eventType !== undefined) {
    if (record.eventType !== null && typeof record.eventType !== 'string') {
      throw new Error('Invalid eventType')
    }
    if (
      record.eventType != null &&
      record.eventType !== '' &&
      !isValidEventType(record.eventType)
    ) {
      throw new Error('Invalid eventType')
    }
    patch.eventType = record.eventType as string | null
  }
  if (record.eventFormat !== undefined) {
    if (record.eventFormat !== null && typeof record.eventFormat !== 'string') {
      throw new Error('Invalid eventFormat')
    }
    if (
      record.eventFormat != null &&
      record.eventFormat !== '' &&
      !isValidEventFormat(record.eventFormat)
    ) {
      throw new Error('Invalid eventFormat')
    }
    patch.eventFormat = record.eventFormat as string | null
  }
  if (record.ballType !== undefined) {
    if (record.ballType !== null && typeof record.ballType !== 'string') {
      throw new Error('Invalid ballType')
    }
    if (
      record.ballType != null &&
      record.ballType !== '' &&
      !isValidBallType(record.ballType)
    ) {
      throw new Error('Invalid ballType')
    }
    patch.ballType = record.ballType as string | null
  }
  if (record.gender !== undefined) {
    if (record.gender !== null && typeof record.gender !== 'string') {
      throw new Error('Invalid gender')
    }
    if (
      record.gender != null &&
      record.gender !== '' &&
      !isValidEventGender(record.gender)
    ) {
      throw new Error('Invalid gender')
    }
    patch.gender = record.gender as string | null
  }
  if (record.notes !== undefined) {
    const parsed = parseOptionalTrimmedText(record.notes)
    if (parsed === undefined) throw new Error('notes must be a string or null')
    patch.notes = parsed
  }
  if (record.pairingEnabled !== undefined) {
    if (typeof record.pairingEnabled !== 'boolean') {
      throw new Error('pairingEnabled must be a boolean')
    }
    patch.pairingEnabled = record.pairingEnabled
  }
  if (record.teamNames !== undefined) {
    if (!Array.isArray(record.teamNames)) {
      throw new Error('teamNames must be an array of strings')
    }
    patch.teamNames = record.teamNames as string[]
  }
  if (record.teamsLocked !== undefined) {
    if (typeof record.teamsLocked !== 'boolean') {
      throw new Error('teamsLocked must be a boolean')
    }
    patch.teamsLocked = record.teamsLocked
  }
  if (record.finalizeTeams !== undefined) {
    if (typeof record.finalizeTeams !== 'boolean') {
      throw new Error('finalizeTeams must be a boolean')
    }
    patch.finalizeTeams = record.finalizeTeams
  }
  if (record.publishedToPlayerApp !== undefined) {
    if (typeof record.publishedToPlayerApp !== 'boolean') {
      throw new Error('publishedToPlayerApp must be a boolean')
    }
    patch.publishedToPlayerApp = record.publishedToPlayerApp
  }
  if (record.publicDescription !== undefined) {
    const parsed = parseOptionalTrimmedText(record.publicDescription)
    if (parsed === undefined) {
      throw new Error('publicDescription must be a string or null')
    }
    patch.publicDescription = parsed
  }
  if (record.location !== undefined) {
    const parsed = parseOptionalTrimmedText(record.location)
    if (parsed === undefined) throw new Error('location must be a string or null')
    patch.location = parsed
  }
  if (record.sessionTimeLabel !== undefined) {
    const parsed = parseOptionalTrimmedText(record.sessionTimeLabel)
    if (parsed === undefined) {
      throw new Error('sessionTimeLabel must be a string or null')
    }
    patch.sessionTimeLabel = parsed
  }
  if (record.priceCents !== undefined) {
    const parsed = parseOptionalNonNegativeInt(record.priceCents)
    if (parsed === undefined) {
      throw new Error('priceCents must be a non-negative integer or null')
    }
    patch.priceCents = parsed
  }
  if (record.capacity !== undefined) {
    const parsed = parseOptionalPositiveInt(record.capacity)
    if (parsed === undefined) {
      throw new Error('capacity must be a positive integer or null')
    }
    patch.capacity = parsed
  }
  if (record.registrationOpensAt !== undefined) {
    const parsed = parseOptionalIsoTimestamp(record.registrationOpensAt)
    if (parsed === undefined) {
      throw new Error('registrationOpensAt must be an ISO timestamp or null')
    }
    patch.registrationOpensAt = parsed
  }
  if (record.registrationClosesAt !== undefined) {
    const parsed = parseOptionalIsoTimestamp(record.registrationClosesAt)
    if (parsed === undefined) {
      throw new Error('registrationClosesAt must be an ISO timestamp or null')
    }
    patch.registrationClosesAt = parsed
  }
  if (record.eventEndDate !== undefined) {
    const parsed = parseOptionalEventEndDate(record.eventEndDate)
    if (parsed === undefined) {
      throw new Error('eventEndDate must be YYYY-MM-DD or null')
    }
    patch.eventEndDate = parsed
  }

  return patch
}
