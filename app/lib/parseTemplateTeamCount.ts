const WORD_TO_NUM: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
}

/**
 * Reads team count from a league template file name, e.g. "Six Team League", "4-team roster".
 * Returns null if no recognizable pattern.
 */
export function parseTeamCountFromTemplateName(filename: string): number | null {
  const base = filename.replace(/\.[^.]+$/, '').trim()
  if (!base) return null

  const digit = base.match(/\b(\d{1,2})\s*[-_]?\s*teams?\b/i)
  if (digit) {
    const n = parseInt(digit[1], 10)
    return n >= 1 && n <= 99 ? n : null
  }

  for (const [word, n] of Object.entries(WORD_TO_NUM)) {
    if (new RegExp(`\\b${word}\\s+teams?\\b`, 'i').test(base)) return n
  }

  return null
}
