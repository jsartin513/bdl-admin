import { SKILL_LEVELS, isValidSkillLevel, linearSkillBand } from '@/app/lib/players/skill'
import { genderLabel } from '@/app/lib/players/gender'

/** Allowlisted fields on captain-facing draft pool / roster players. */
export const CAPTAIN_DRAFT_PLAYER_FIELD_KEYS = [
  'registrationId',
  'displayName',
  'genderLabel',
  'skillLabel',
  'photoUrl',
] as const

export type CaptainDraftPlayerFieldKey = (typeof CAPTAIN_DRAFT_PLAYER_FIELD_KEYS)[number]

export type CaptainDraftPoolPlayer = {
  registrationId: string
  displayName: string
  genderLabel: string
  skillLabel: string
  photoUrl: string | null
}

export type CaptainDraftTeamRequirement = {
  draftGroup: number
  teamName: string
  womenNbCount: number
  womenNbRequired: number
  intermediateCount: number
  intermediateRequired: number
}

export type CaptainDraftRosterPlayer = CaptainDraftPoolPlayer & {
  pickNumber: number | null
}

export type CaptainDraftTeamRoster = {
  draftGroup: number
  teamName: string
  players: CaptainDraftRosterPlayer[]
  requirements: CaptainDraftTeamRequirement
}

export type CaptainDraftTurn = {
  pickIndex: number
  draftGroup: number
  teamName: string
  isComplete: boolean
}

export type CaptainDraftRules = {
  minWomenNb: number
  includeOtherInWomenNb: boolean
  minIntermediate: number
  intermediateMin: number
  intermediateMax: number
}

export const DEFAULT_CAPTAIN_DRAFT_RULES: CaptainDraftRules = {
  minWomenNb: 3,
  includeOtherInWomenNb: false,
  minIntermediate: 2,
  intermediateMin: 30,
  intermediateMax: 50,
}

export type CaptainDraftSnapshot = {
  version: 1
  eventId: string
  eventName: string
  status: 'setup' | 'live' | 'paused' | 'complete'
  viewer: {
    email: string
    draftGroup: number | null
    isCaptain: boolean
  }
  turn: CaptainDraftTurn | null
  pool: CaptainDraftPoolPlayer[]
  teams: CaptainDraftTeamRoster[]
  rules: CaptainDraftRules
  playDraftUrl: string
}

export const CAPTAIN_DRAFT_FORBIDDEN_KEYS = [
  'email',
  'emails',
  'phone',
  'phones',
  'skillLevel',
  'skill_level',
  'skillLevelFib',
  'skill_level_fib',
  'skillAreas',
  'skill_areas',
  'selfReportedSkill',
  'self_reported_skill',
  'strongPersonalityNotes',
  'strong_personality_notes',
  'hasStrongPersonality',
  'has_strong_personality',
  'playerAppAccountId',
  'player_app_account_id',
  'primaryEmail',
  'primary_email',
  'notes',
  'strongPersonality',
  'personNotes',
  'person_notes',
  'firstName',
  'first_name',
  'lastName',
  'last_name',
  'rosterName',
  'roster_name',
  'nickname',
  'jerseyNumber',
  'jersey_number',
  'homeLeagues',
  'home_leagues',
  'importBatchId',
  'import_batch_id',
  'actor',
  'before',
  'after',
] as const

/** Board-curated linear skill label only (anchor names, no fib / areas). */
export function captainCuratedSkillLabel(skillLevel: number | null | undefined): string {
  if (skillLevel == null || !isValidSkillLevel(skillLevel)) return 'Unset'
  const anchor = linearSkillBand(skillLevel)
  return SKILL_LEVELS[anchor]
}

export function captainDisplayName(input: {
  nickname: string | null
  firstName: string
  lastName: string
}): string {
  const nick = input.nickname?.trim()
  if (nick) return nick
  return `${input.firstName} ${input.lastName}`.trim()
}

export function assertCaptainDraftPayload(value: unknown): void {
  const forbidden = new Set<string>(CAPTAIN_DRAFT_FORBIDDEN_KEYS)
  const walk = (node: unknown, path: string) => {
    if (node === null || typeof node !== 'object') return
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) walk(node[i], `${path}[${i}]`)
      return
    }
    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      const viewerSelfEmail =
        key === 'email' && (path === 'viewer' || path.startsWith('viewer.'))
      if (forbidden.has(key) && !viewerSelfEmail) {
        throw new Error(`Forbidden captain-draft key "${key}" at ${path || 'root'}`)
      }
      walk(child, path ? `${path}.${key}` : key)
    }
  }
  walk(value, '')
}

export function mapToCaptainPoolPlayer(input: {
  registrationId: string
  nickname: string | null
  firstName: string
  lastName: string
  gender: string | null
  skillLevel: number | null
  photoUrl: string | null
}): CaptainDraftPoolPlayer {
  return {
    registrationId: input.registrationId,
    displayName: captainDisplayName(input),
    genderLabel: genderLabel(input.gender),
    skillLabel: captainCuratedSkillLabel(input.skillLevel),
    photoUrl: input.photoUrl,
  }
}
