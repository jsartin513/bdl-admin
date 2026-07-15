export const GENDERS = {
  man: 'Man',
  woman: 'Woman',
  nonbinary: 'Nonbinary',
  other: 'Other',
} as const

export type Gender = keyof typeof GENDERS

/** Drafting / roster balance: woman + nonbinary + other count together. */
export type GenderGroup = 'w_nb_o' | 'men' | 'unset'

const GENDER_ALIASES: Record<string, Gender> = {
  man: 'man',
  male: 'man',
  m: 'man',
  'cisgender man': 'man',
  cisgender_man: 'man',
  'cis man': 'man',
  cis_man: 'man',
  woman: 'woman',
  female: 'woman',
  f: 'woman',
  w: 'woman',
  'cisgender woman': 'woman',
  cisgender_woman: 'woman',
  'cis woman': 'woman',
  cis_woman: 'woman',
  nonbinary: 'nonbinary',
  'non binary': 'nonbinary',
  nb: 'nonbinary',
  enby: 'nonbinary',
  genderqueer: 'nonbinary',
  other: 'other',
  'prefer not to say': 'other',
  prefer_not_to_say: 'other',
  unspecified: 'other',
}

export function isValidGender(value: unknown): value is Gender {
  return value === 'man' || value === 'woman' || value === 'nonbinary' || value === 'other'
}

export function genderLabel(gender: string | null | undefined): string {
  if (gender == null) return '—'
  if (isValidGender(gender)) return GENDERS[gender]
  return '—'
}

export function genderGroup(gender: string | null | undefined): GenderGroup {
  if (gender === 'woman' || gender === 'nonbinary' || gender === 'other') return 'w_nb_o'
  if (gender === 'man') return 'men'
  return 'unset'
}

export function genderGroupLabel(gender: string | null | undefined): string {
  const group = genderGroup(gender)
  if (group === 'w_nb_o') return 'W/NB/O'
  if (group === 'men') return 'M'
  return '—'
}

/** Sort key: W/NB/O first, then men, then unset. */
export function genderGroupSortKey(gender: string | null | undefined): number {
  const group = genderGroup(gender)
  if (group === 'w_nb_o') return 0
  if (group === 'men') return 1
  return 2
}

export function parseGender(value: string | null | undefined): Gender | null {
  if (value == null) return null
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
  if (!normalized) return null
  const underscored = normalized.replace(/\s+/g, '_')
  return GENDER_ALIASES[normalized] ?? GENDER_ALIASES[underscored] ?? null
}
