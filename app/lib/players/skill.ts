/** Linear skill anchors (legacy 1–4 × 20). Midpoints (e.g. 30, 50) are allowed. */
export const SKILL_LEVELS = {
  20: 'Beginner',
  40: 'Intermediate',
  60: 'Advanced',
  80: 'Worlds level',
} as const

export type SkillLevel = keyof typeof SKILL_LEVELS

export const LINEAR_SKILL_MIN = 1
export const LINEAR_SKILL_MAX = 100

export const FIB_SKILL_LEVELS = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89] as const
export type FibSkillLevel = (typeof FIB_SKILL_LEVELS)[number]

export const SKILL_AREA_KEYS = [
  'offense',
  'defense',
  'stayingAlive',
  'courtPresence',
] as const

export type SkillAreaKey = (typeof SKILL_AREA_KEYS)[number]

export const SKILL_AREA_LABELS: Record<SkillAreaKey, string> = {
  offense: 'Offense',
  defense: 'Defense',
  stayingAlive: 'Staying alive',
  courtPresence: 'Court presence / play calling',
}

export type SkillAreas = {
  offense: number | null
  defense: number | null
  stayingAlive: number | null
  courtPresence: number | null
}

export type SkillViewMode = 'linear' | 'fibonacci' | 'areas'

export const SKILL_VIEW_MODES: readonly SkillViewMode[] = [
  'linear',
  'fibonacci',
  'areas',
] as const

export const SKILL_VIEW_MODE_LABELS: Record<SkillViewMode, string> = {
  linear: 'Normal',
  fibonacci: 'Fibonacci',
  areas: 'Skill areas',
}

export const SKILL_VIEW_MODE_STORAGE_KEY = 'bdl-admin.skillViewMode'

const SKILL_LABEL_TO_LEVEL: Record<string, number> = {
  '1': 20,
  beginner: 20,
  beg: 20,
  '20': 20,
  '2': 40,
  intermediate: 40,
  intermed: 40,
  inter: 40,
  mid: 40,
  '40': 40,
  '3': 60,
  advanced: 60,
  adv: 60,
  '60': 60,
  '4': 80,
  worlds: 80,
  'worlds level': 80,
  world: 80,
  '80': 80,
}

const FIB_SET = new Set<number>(FIB_SKILL_LEVELS)
const LINEAR_ANCHORS = Object.keys(SKILL_LEVELS)
  .map(Number)
  .sort((a, b) => a - b) as SkillLevel[]

export function emptySkillAreas(): SkillAreas {
  return {
    offense: null,
    defense: null,
    stayingAlive: null,
    courtPresence: null,
  }
}

export function isValidSkillViewMode(value: unknown): value is SkillViewMode {
  return value === 'linear' || value === 'fibonacci' || value === 'areas'
}

/** Linear skill: any integer in 1–100 (anchors at 20/40/60/80). */
export function isValidSkillLevel(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= LINEAR_SKILL_MIN &&
    value <= LINEAR_SKILL_MAX
  )
}

export function isValidFibSkillLevel(value: unknown): value is FibSkillLevel {
  return typeof value === 'number' && Number.isInteger(value) && FIB_SET.has(value)
}

export function isSkillAreaKey(value: unknown): value is SkillAreaKey {
  return (
    typeof value === 'string' &&
    (SKILL_AREA_KEYS as readonly string[]).includes(value)
  )
}

/** True when level matches a named linear anchor exactly. */
export function isLinearSkillAnchor(value: unknown): value is SkillLevel {
  return typeof value === 'number' && value in SKILL_LEVELS
}

/** Nearest lower-or-equal linear anchor; values below 20 map to 20. */
export function linearSkillBand(level: number): SkillLevel {
  let best: SkillLevel = LINEAR_ANCHORS[0]
  for (const anchor of LINEAR_ANCHORS) {
    if (level >= anchor) best = anchor
  }
  return best
}

export function skillLevelLabel(level: number | null | undefined): string {
  if (level == null || !isValidSkillLevel(level)) return 'Unset'
  if (isLinearSkillAnchor(level)) return SKILL_LEVELS[level]
  return `${level} (${SKILL_LEVELS[linearSkillBand(level)]})`
}

/** Parse TeamLinkt / CSV skill cells (labels, legacy 1–4, or new ×20 numbers). */
export function parseSkillLevel(value: string | null | undefined): number | null {
  if (value == null) return null
  const normalized = value.trim().toLowerCase().replace(/[_]+/g, ' ').replace(/\s+/g, ' ')
  if (!normalized) return null
  if (normalized in SKILL_LABEL_TO_LEVEL) return SKILL_LABEL_TO_LEVEL[normalized]

  // Excel / Sheets often emit "2.0" for legacy level 2
  const trailingDotZero = normalized.match(/^([1-4])\.0+$/)
  if (trailingDotZero) return SKILL_LABEL_TO_LEVEL[trailingDotZero[1]] ?? null

  const asNum = Number(normalized)
  if (isValidSkillLevel(asNum)) return asNum

  // "2 - Intermediate", "Intermediate (2)", "Level 3"
  const digitMatch = normalized.match(/(?:^|[^\d])([1-4])(?:[^\d]|$)/)
  if (digitMatch && digitMatch[1] in SKILL_LABEL_TO_LEVEL) {
    return SKILL_LABEL_TO_LEVEL[digitMatch[1]]
  }

  for (const [label, level] of Object.entries(SKILL_LABEL_TO_LEVEL)) {
    if (/^\d+$/.test(label)) continue
    if (normalized.includes(label)) return level
  }

  return null
}

export function parseSkillAreas(value: unknown): SkillAreas | null {
  if (value == null) return null
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid skill areas')
  }
  const raw = value as Record<string, unknown>
  const result = emptySkillAreas()
  let anyKey = false
  for (const key of SKILL_AREA_KEYS) {
    if (!(key in raw)) continue
    anyKey = true
    const v = raw[key]
    if (v === null || v === '') {
      result[key] = null
      continue
    }
    const n = typeof v === 'number' ? v : Number(v)
    if (!isValidSkillLevel(n)) throw new Error(`Invalid skill area: ${key}`)
    result[key] = n
  }
  if (!anyKey) return null
  if (SKILL_AREA_KEYS.every((k) => result[k] == null)) return null
  return result
}

/** Merge a partial areas patch onto existing areas (null fields clear that area). */
export function mergeSkillAreasPatch(
  existing: SkillAreas | null | undefined,
  patch: Partial<SkillAreas> | null
): SkillAreas | null {
  if (patch == null) return null
  const base = existing ?? emptySkillAreas()
  const next: SkillAreas = { ...base }
  for (const key of SKILL_AREA_KEYS) {
    if (key in patch) {
      const v = patch[key]
      if (v === undefined) continue
      if (v !== null && !isValidSkillLevel(v)) {
        throw new Error(`Invalid skill area: ${key}`)
      }
      next[key] = v
    }
  }
  if (SKILL_AREA_KEYS.every((k) => next[k] == null)) return null
  return next
}

export function resolveSkillAreaValue(
  areas: SkillAreas | null | undefined,
  key: SkillAreaKey,
  linearFallback: number | null | undefined
): number | null {
  const stored = areas?.[key]
  if (stored != null && isValidSkillLevel(stored)) return stored
  if (linearFallback != null && isValidSkillLevel(linearFallback)) return linearFallback
  return null
}

export type SkillScoreSource = {
  skillLevel?: number | null
  skillLevelFib?: number | null
  skillAreas?: SkillAreas | null
}

/** Effective numeric skill for the active view mode (null = unset). */
export function effectiveSkillScore(
  player: SkillScoreSource,
  mode: SkillViewMode
): number | null {
  if (mode === 'linear') {
    return player.skillLevel != null && isValidSkillLevel(player.skillLevel)
      ? player.skillLevel
      : null
  }
  if (mode === 'fibonacci') {
    return player.skillLevelFib != null && isValidFibSkillLevel(player.skillLevelFib)
      ? player.skillLevelFib
      : null
  }

  const values = SKILL_AREA_KEYS.map((key) =>
    resolveSkillAreaValue(player.skillAreas, key, player.skillLevel)
  )
  if (values.every((v) => v == null)) return null
  const present = values.filter((v): v is number => v != null)
  if (present.length === 0) return null
  const avg = present.reduce((sum, n) => sum + n, 0) / present.length
  return Math.round(avg * 10) / 10
}

export function formatSkillAreasCompact(
  player: SkillScoreSource
): string | null {
  if (
    player.skillLevel == null &&
    (!player.skillAreas || SKILL_AREA_KEYS.every((k) => player.skillAreas?.[k] == null))
  ) {
    return null
  }
  const parts = SKILL_AREA_KEYS.map((key) => {
    const v = resolveSkillAreaValue(player.skillAreas, key, player.skillLevel)
    return v == null ? '—' : String(v)
  })
  return parts.join('/')
}

export function effectiveSkillLabel(
  player: SkillScoreSource,
  mode: SkillViewMode
): string {
  if (mode === 'linear') {
    return skillLevelLabel(player.skillLevel)
  }
  if (mode === 'fibonacci') {
    if (player.skillLevelFib == null || !isValidFibSkillLevel(player.skillLevelFib)) {
      return 'Unset'
    }
    return String(player.skillLevelFib)
  }
  const score = effectiveSkillScore(player, 'areas')
  if (score == null) return 'Unset'
  const compact = formatSkillAreasCompact(player)
  return compact ? `avg ${score} (${compact})` : `avg ${score}`
}

/**
 * Matrix / filter bucket key for an effective score.
 * Linear & areas → nearest lower-or-equal anchor; fibonacci → exact fib or unset.
 */
export function skillMatrixBucketKey(
  score: number | null,
  mode: SkillViewMode
): string {
  if (score == null) return 'unset'
  if (mode === 'fibonacci') {
    const fib = Math.round(score)
    return isValidFibSkillLevel(fib) ? String(fib) : 'unset'
  }
  if (!Number.isFinite(score)) return 'unset'
  return String(linearSkillBand(Math.round(score)))
}

export function skillMatrixColumns(mode: SkillViewMode): readonly (number | null)[] {
  if (mode === 'fibonacci') return [...FIB_SKILL_LEVELS, null]
  return [...LINEAR_ANCHORS, null]
}

export function skillMatrixColLabel(level: number | null, mode: SkillViewMode): string {
  if (level == null) return 'Unset'
  if (mode === 'fibonacci') return String(level)
  return SKILL_LEVELS[level as SkillLevel] ?? String(level)
}

export type SkillStyleKind = 'beginner' | 'normal' | 'advanced' | 'worlds'

export function skillStyleKind(
  score: number | null,
  mode: SkillViewMode
): SkillStyleKind {
  if (score == null) return 'normal'
  if (mode === 'fibonacci') {
    if (score <= 2) return 'beginner'
    if (score >= 55) return 'worlds'
    if (score >= 21) return 'advanced'
    return 'normal'
  }
  if (score <= 20) return 'beginner'
  if (score >= 80) return 'worlds'
  if (score >= 60) return 'advanced'
  return 'normal'
}

export function defaultRosterName(firstName: string, lastName: string): string {
  return `${firstName.trim()} ${lastName.trim()}`.trim()
}

/** Default nickname: first name + last initial (e.g. "Jess S"). */
export function defaultNickname(firstName: string, lastName: string): string {
  const first = firstName.trim()
  const last = lastName.trim()
  if (!first) return last ? last.charAt(0).toUpperCase() : ''
  if (!last) return first
  return `${first} ${last.charAt(0).toUpperCase()}`
}

/** Effective nickname: stored custom value, or first + last initial. */
export function resolveNickname(
  nickname: string | null | undefined,
  firstName: string,
  lastName: string
): string {
  const custom = nickname?.trim()
  if (custom) return custom
  return defaultNickname(firstName, lastName)
}

/**
 * Persist null when empty or equal to the default so nickname tracks name changes
 * until someone sets a custom value.
 */
export function normalizeStoredNickname(
  nickname: string | null | undefined,
  firstName: string,
  lastName: string
): string | null {
  const trimmed = nickname?.trim() ?? ''
  if (!trimmed) return null
  if (trimmed.toLowerCase() === defaultNickname(firstName, lastName).toLowerCase()) {
    return null
  }
  return trimmed
}

/** Default jersey name: last name. */
export function defaultJerseyName(lastName: string): string {
  return lastName.trim()
}

export function resolveJerseyName(
  jerseyName: string | null | undefined,
  lastName: string
): string {
  const custom = jerseyName?.trim()
  if (custom) return custom
  return defaultJerseyName(lastName)
}

export function normalizeStoredJerseyName(
  jerseyName: string | null | undefined,
  lastName: string
): string | null {
  const trimmed = jerseyName?.trim() ?? ''
  if (!trimmed) return null
  if (trimmed.toLowerCase() === defaultJerseyName(lastName).toLowerCase()) {
    return null
  }
  return trimmed
}
