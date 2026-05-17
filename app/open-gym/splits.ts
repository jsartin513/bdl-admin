/**
 * Team-split calculation logic for Open Gym.
 *
 * Given a total player count, finds all valid (numTeams, teamSize) configurations
 * where numTeams ∈ {2,3,4,5,6} and every team has 5–8 players.
 * Results are sorted by preference: closest average size to 6 (ideal), with
 * more teams preferred as a tiebreaker (less rest time per team).
 */

export interface SplitConfig {
  numTeams: number
  /** Smaller of the two possible per-team sizes. */
  baseSize: number
  /** Number of teams with baseSize + 1 players (0 if all teams are equal size). */
  large: number
  /** Number of teams with baseSize players. */
  small: number
  /** Lower score = more preferred. */
  score: number
}

export function getConfigs(n: number): SplitConfig[] {
  if (n < 10 || n > 48) return []
  const configs: SplitConfig[] = []
  for (const t of [2, 3, 4, 5, 6]) {
    const q = Math.floor(n / t)
    const r = n % t
    const maxSize = r > 0 ? q + 1 : q
    if (q < 5 || maxSize > 8) continue
    configs.push({
      numTeams: t,
      baseSize: q,
      large: r,
      small: t - r,
      score: Math.abs(n / t - 6) - 0.05 * t,
    })
  }
  return configs.sort((a, b) => a.score - b.score)
}

export function describeConfig(c: SplitConfig): string {
  if (c.large === 0) return `${c.numTeams} teams of ${c.baseSize}`
  return `${c.large}×${c.baseSize + 1} + ${c.small}×${c.baseSize}`
}

export function sizeLabel(c: SplitConfig): string {
  return c.large === 0
    ? `${c.baseSize}v${c.baseSize}`
    : `${c.baseSize}–${c.baseSize + 1}v${c.baseSize}–${c.baseSize + 1}`
}
