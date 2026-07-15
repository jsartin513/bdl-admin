export const SKILL_LEVELS = {
  1: 'Beginner',
  2: 'Intermediate',
  3: 'Advanced',
  4: 'Worlds level',
} as const

export type SkillLevel = keyof typeof SKILL_LEVELS

export function isValidSkillLevel(value: unknown): value is SkillLevel {
  return value === 1 || value === 2 || value === 3 || value === 4
}

export function skillLevelLabel(level: number | null | undefined): string {
  if (level == null) return 'Unset'
  if (isValidSkillLevel(level)) return SKILL_LEVELS[level]
  return 'Unset'
}

export function defaultRosterName(firstName: string, lastName: string): string {
  return `${firstName.trim()} ${lastName.trim()}`.trim()
}
