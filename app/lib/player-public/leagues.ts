import {
  HOME_LEAGUE_CODES,
  HOME_LEAGUES,
  HOME_LEAGUE_LOGOS,
  type HomeLeague,
} from '@/app/lib/players/home-league'

/** Allowlisted fields for `GET /api/public/leagues` (player app contract). */
export const PUBLIC_LEAGUE_FIELD_KEYS = ['code', 'name', 'logoPath'] as const

export type PublicLeagueFieldKey = (typeof PUBLIC_LEAGUE_FIELD_KEYS)[number]

export type PublicLeague = {
  code: HomeLeague
  name: string
  logoPath: string
}

/**
 * Keys that must never appear on public league payloads (PII / board-only data).
 * Tests scan serialized JSON for these names.
 */
export const PUBLIC_LEAGUE_FORBIDDEN_KEYS = [
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
  'playerAppAccountId',
  'player_app_account_id',
  'messagingPrefs',
  'importBatchId',
  'before',
  'after',
  'actor',
] as const

export function listPublicLeagues(): PublicLeague[] {
  return HOME_LEAGUE_CODES.map((code) => ({
    code,
    name: HOME_LEAGUES[code],
    logoPath: HOME_LEAGUE_LOGOS[code],
  }))
}

export function assertPublicLeaguePayload(value: unknown): void {
  const forbidden = new Set<string>(PUBLIC_LEAGUE_FORBIDDEN_KEYS)
  const walk = (node: unknown, path: string) => {
    if (node === null || typeof node !== 'object') return
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${path}[${i}]`))
      return
    }
    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      if (forbidden.has(key)) {
        throw new Error(`Forbidden public league key "${key}" at ${path || 'root'}`)
      }
      walk(child, path ? `${path}.${key}` : key)
    }
  }
  walk(value, '')
}
