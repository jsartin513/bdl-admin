import { genderGroup, type GenderGroup } from '@/app/lib/players/gender'

export type DraftSeedPlayer = {
  id: string
  skillLevel: number | null
  gender: string | null
}

/** Default team count targeting ~7–8 players per team. */
export function defaultTeamCount(playerCount: number): number {
  if (playerCount <= 0) return 1
  return Math.max(1, Math.round(playerCount / 7.5))
}

function skillScore(skillLevel: number | null): number {
  return skillLevel ?? 0
}

function sortBySkillDesc(players: DraftSeedPlayer[]): DraftSeedPlayer[] {
  return [...players].sort((a, b) => {
    const skillDiff = skillScore(b.skillLevel) - skillScore(a.skillLevel)
    if (skillDiff !== 0) return skillDiff
    return a.id.localeCompare(b.id)
  })
}

/**
 * Auto-seed teams: gender-balanced (W/NB/O vs men), skill-aware snake draft.
 * Returns map of player id → team number (1..teamCount). Unset gender players
 * are placed last into the currently smallest / lowest-score teams.
 */
export function autoSeedDraftGroups(
  players: DraftSeedPlayer[],
  teamCount: number
): Map<string, number> {
  const n = Math.max(1, Math.floor(teamCount))
  const assignments = new Map<string, number>()

  if (players.length === 0) return assignments

  const pools: Record<GenderGroup, DraftSeedPlayer[]> = {
    w_nb_o: [],
    men: [],
    unset: [],
  }
  for (const p of players) {
    pools[genderGroup(p.gender)].push(p)
  }
  for (const key of Object.keys(pools) as GenderGroup[]) {
    pools[key] = sortBySkillDesc(pools[key])
  }

  const teamSizes = Array.from({ length: n }, () => 0)
  const teamScores = Array.from({ length: n }, () => 0)
  const teamGender = Array.from({ length: n }, () => ({ w_nb_o: 0, men: 0 }))

  function pickTeam(preferGender: 'w_nb_o' | 'men' | null): number {
    let best = 0
    let bestKey: [number, number, number, number] | null = null

    for (let i = 0; i < n; i++) {
      const genderImbalance =
        preferGender == null
          ? 0
          : preferGender === 'w_nb_o'
            ? teamGender[i].w_nb_o - teamGender[i].men
            : teamGender[i].men - teamGender[i].w_nb_o
      // Prefer: smaller size, then lower gender imbalance for preferred group,
      // then lower skill total, then lower index (stable).
      const key: [number, number, number, number] = [
        teamSizes[i],
        genderImbalance,
        teamScores[i],
        i,
      ]
      if (
        bestKey == null ||
        key[0] < bestKey[0] ||
        (key[0] === bestKey[0] && key[1] < bestKey[1]) ||
        (key[0] === bestKey[0] && key[1] === bestKey[1] && key[2] < bestKey[2]) ||
        (key[0] === bestKey[0] &&
          key[1] === bestKey[1] &&
          key[2] === bestKey[2] &&
          key[3] < bestKey[3])
      ) {
        best = i
        bestKey = key
      }
    }
    return best
  }

  function assign(player: DraftSeedPlayer, teamIndex: number) {
    const team = teamIndex + 1
    assignments.set(player.id, team)
    teamSizes[teamIndex]++
    teamScores[teamIndex] += skillScore(player.skillLevel)
    const g = genderGroup(player.gender)
    if (g === 'w_nb_o') teamGender[teamIndex].w_nb_o++
    else if (g === 'men') teamGender[teamIndex].men++
  }

  // Interleave W/NB/O and men by skill (snake-style via pickTeam heuristics).
  const primary = pools.w_nb_o
  const secondary = pools.men
  let i = 0
  let j = 0
  let takePrimary = primary.length >= secondary.length

  while (i < primary.length || j < secondary.length) {
    if (takePrimary && i < primary.length) {
      assign(primary[i++], pickTeam('w_nb_o'))
    } else if (!takePrimary && j < secondary.length) {
      assign(secondary[j++], pickTeam('men'))
    } else if (i < primary.length) {
      assign(primary[i++], pickTeam('w_nb_o'))
    } else if (j < secondary.length) {
      assign(secondary[j++], pickTeam('men'))
    }
    takePrimary = !takePrimary
  }

  for (const player of pools.unset) {
    assign(player, pickTeam(null))
  }

  return assignments
}

/** Empty seed: everyone unassigned. */
export function emptySeedDraftGroups(
  players: DraftSeedPlayer[]
): Map<string, number | null> {
  const assignments = new Map<string, number | null>()
  for (const p of players) {
    assignments.set(p.id, null)
  }
  return assignments
}

/** Copy permanent draftGroup into local workspace. */
export function copyExistingDraftGroups(
  players: Array<DraftSeedPlayer & { draftGroup: number | null }>
): Map<string, number | null> {
  const assignments = new Map<string, number | null>()
  for (const p of players) {
    assignments.set(p.id, p.draftGroup)
  }
  return assignments
}

export function teamSkillTotal(
  players: Array<{ skillLevel: number | null }>
): number {
  return players.reduce((sum, p) => sum + skillScore(p.skillLevel), 0)
}

export function teamGenderCounts(players: Array<{ gender: string | null }>): {
  wNbO: number
  men: number
  unset: number
} {
  let wNbO = 0
  let men = 0
  let unset = 0
  for (const p of players) {
    const g = genderGroup(p.gender)
    if (g === 'w_nb_o') wNbO++
    else if (g === 'men') men++
    else unset++
  }
  return { wNbO, men, unset }
}
