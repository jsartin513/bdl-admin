export const SKILL_LEVELS = {
  1: 'Beginner',
  2: 'Intermediate',
  3: 'Advanced',
  4: 'Worlds level',
} as const

export type SkillLevel = keyof typeof SKILL_LEVELS

const SKILL_LABEL_TO_LEVEL: Record<string, SkillLevel> = {
  '1': 1,
  beginner: 1,
  beg: 1,
  '2': 2,
  intermediate: 2,
  intermed: 2,
  inter: 2,
  mid: 2,
  '3': 3,
  advanced: 3,
  adv: 3,
  '4': 4,
  worlds: 4,
  'worlds level': 4,
  world: 4,
}

export function isValidSkillLevel(value: unknown): value is SkillLevel {
  return value === 1 || value === 2 || value === 3 || value === 4
}

export function skillLevelLabel(level: number | null | undefined): string {
  if (level == null) return 'Unset'
  if (isValidSkillLevel(level)) return SKILL_LEVELS[level]
  return 'Unset'
}

/** Parse TeamLinkt / CSV skill cells (labels or 1–4). */
export function parseSkillLevel(value: string | null | undefined): SkillLevel | null {
  if (value == null) return null
  const normalized = value.trim().toLowerCase().replace(/[_]+/g, ' ').replace(/\s+/g, ' ')
  if (!normalized) return null
  return SKILL_LABEL_TO_LEVEL[normalized] ?? null
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
