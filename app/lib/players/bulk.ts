import { isValidGender } from '@/app/lib/players/gender'
import { isValidHomeLeague } from '@/app/lib/players/home-league'
import { isValidSkillLevel } from '@/app/lib/players/skill'
import { shouldPromptForStrongPersonalityNotes } from '@/app/lib/players/strong-personality'

export type BulkPlayerPatch = {
  gender?: string | null
  skillLevel?: number | null
  hasStrongPersonality?: boolean
  strongPersonalityNotes?: string | null
  addHomeLeague?: string
  removeHomeLeague?: string
}

export type ParsedBulkPlayerRequest = {
  playerIds: string[]
  patch: BulkPlayerPatch
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Parse and validate a bulk players PATCH body. Throws Error with a user-facing message. */
export function parseBulkPlayerRequest(body: unknown): ParsedBulkPlayerRequest {
  if (!isPlainObject(body)) {
    throw new Error('Request body must be an object')
  }

  if (!Array.isArray(body.playerIds) || body.playerIds.length === 0) {
    throw new Error('playerIds must be a non-empty array')
  }

  const playerIds: string[] = []
  const seen = new Set<string>()
  for (const id of body.playerIds) {
    if (typeof id !== 'string' || !id.trim()) {
      throw new Error('Each playerId must be a non-empty string')
    }
    if (seen.has(id)) continue
    seen.add(id)
    playerIds.push(id)
  }

  if (!isPlainObject(body.patch)) {
    throw new Error('patch must be an object')
  }

  const raw = body.patch
  const patch: BulkPlayerPatch = {}

  if ('gender' in raw) {
    if (raw.gender === null) {
      patch.gender = null
    } else if (typeof raw.gender === 'string' && isValidGender(raw.gender)) {
      patch.gender = raw.gender
    } else {
      throw new Error('Invalid gender')
    }
  }

  if ('skillLevel' in raw) {
    if (raw.skillLevel === null) {
      patch.skillLevel = null
    } else if (isValidSkillLevel(raw.skillLevel)) {
      patch.skillLevel = raw.skillLevel
    } else {
      throw new Error('Invalid skill level')
    }
  }

  if ('hasStrongPersonality' in raw) {
    if (typeof raw.hasStrongPersonality !== 'boolean') {
      throw new Error('hasStrongPersonality must be a boolean')
    }
    patch.hasStrongPersonality = raw.hasStrongPersonality
  }

  if ('strongPersonalityNotes' in raw) {
    if (raw.strongPersonalityNotes === null) {
      patch.strongPersonalityNotes = null
    } else if (typeof raw.strongPersonalityNotes === 'string') {
      patch.strongPersonalityNotes = raw.strongPersonalityNotes.trim() || null
    } else {
      throw new Error('strongPersonalityNotes must be a string or null')
    }
  }

  if ('addHomeLeague' in raw) {
    if (typeof raw.addHomeLeague !== 'string' || !isValidHomeLeague(raw.addHomeLeague)) {
      throw new Error('Invalid addHomeLeague')
    }
    patch.addHomeLeague = raw.addHomeLeague
  }

  if ('removeHomeLeague' in raw) {
    if (typeof raw.removeHomeLeague !== 'string' || !isValidHomeLeague(raw.removeHomeLeague)) {
      throw new Error('Invalid removeHomeLeague')
    }
    patch.removeHomeLeague = raw.removeHomeLeague
  }

  if (
    patch.gender === undefined &&
    patch.skillLevel === undefined &&
    patch.hasStrongPersonality === undefined &&
    patch.strongPersonalityNotes === undefined &&
    patch.addHomeLeague === undefined &&
    patch.removeHomeLeague === undefined
  ) {
    throw new Error('patch must include at least one field to update')
  }

  if (patch.hasStrongPersonality === true) {
    const notes = patch.strongPersonalityNotes ?? ''
    if (shouldPromptForStrongPersonalityNotes(true, notes)) {
      throw new Error('strongPersonalityNotes are required when enabling strong personality')
    }
  }

  return { playerIds, patch }
}

export function bulkPatchHasCoreFields(patch: BulkPlayerPatch): boolean {
  return (
    patch.gender !== undefined ||
    patch.skillLevel !== undefined ||
    patch.hasStrongPersonality !== undefined ||
    patch.strongPersonalityNotes !== undefined
  )
}
