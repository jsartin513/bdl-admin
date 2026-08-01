import { genderGroup, type GenderGroup } from '@/app/lib/players/gender'

export type DraftSeedPlayer = {
  id: string
  skillLevel: number | null
  gender: string | null
  /** Shared id links two players as a pair that must stay together. */
  pairId?: string | null
}

export type AutoSeedOptions = {
  /** When true, randomize equal-skill order and team index tie-breaks. */
  shuffle?: boolean
  /** RNG in [0, 1). Defaults to Math.random. Inject for tests. */
  random?: () => number
}

type DraftUnit = {
  id: string
  members: DraftSeedPlayer[]
  skillTotal: number
  preferGender: 'w_nb_o' | 'men' | null
  poolGender: GenderGroup
}

/**
 * Format expected players-per-team as an integer or range (e.g. "7" or "7–8").
 */
export function playersPerTeamLabel(
  playerCount: number,
  teamCount: number
): string {
  if (playerCount <= 0 || teamCount <= 0) return '0'
  const t = Math.max(1, Math.floor(teamCount))
  const base = Math.floor(playerCount / t)
  const rem = playerCount % t
  if (rem === 0) return String(base)
  return `${base}–${base + 1}`
}

/** Penalty for a single team size. Ideal band is 7–8; 6 beats 9. */
function sizePenalty(size: number): number {
  if (size >= 7 && size <= 8) return 0
  if (size < 7) {
    const d = 7 - size
    return d * d // 6→1, 5→4, 4→9, …
  }
  const d = size - 8
  return d * d * 3 // 9→3, 10→12, … (oversized costs more than undersized)
}

function configPenalty(playerCount: number, teams: number): number {
  const base = Math.floor(playerCount / teams)
  const large = playerCount % teams
  const small = teams - large
  return large * sizePenalty(base + 1) + small * sizePenalty(base)
}

/**
 * Default team count targeting 7–8 players per team.
 * Prefers 6 over 9 when the ideal band is unreachable.
 * Tie-break: fewer teams (larger teams when equally good).
 */
export function defaultTeamCount(playerCount: number): number {
  if (playerCount <= 0) return 1
  let bestTeams = 1
  let bestPenalty = configPenalty(playerCount, 1)
  for (let t = 2; t <= playerCount; t++) {
    const penalty = configPenalty(playerCount, t)
    if (penalty < bestPenalty) {
      bestPenalty = penalty
      bestTeams = t
    }
  }
  return bestTeams
}

function skillScore(skillLevel: number | null): number {
  return skillLevel ?? 0
}

function unitPreferGender(members: DraftSeedPlayer[]): 'w_nb_o' | 'men' | null {
  const groups = members.map((m) => genderGroup(m.gender))
  if (groups.some((g) => g === 'w_nb_o')) return 'w_nb_o'
  if (groups.some((g) => g === 'men')) return 'men'
  return null
}

function unitPoolGender(members: DraftSeedPlayer[]): GenderGroup {
  const prefer = unitPreferGender(members)
  if (prefer === 'w_nb_o') return 'w_nb_o'
  if (prefer === 'men') return 'men'
  return 'unset'
}

function buildDraftUnits(players: DraftSeedPlayer[]): DraftUnit[] {
  const units: DraftUnit[] = []
  const seenPairIds = new Set<string>()
  const byPairId = new Map<string, DraftSeedPlayer[]>()

  for (const p of players) {
    if (p.pairId) {
      const list = byPairId.get(p.pairId) ?? []
      list.push(p)
      byPairId.set(p.pairId, list)
    }
  }

  for (const p of players) {
    if (p.pairId) {
      if (seenPairIds.has(p.pairId)) continue
      seenPairIds.add(p.pairId)
      const members = byPairId.get(p.pairId) ?? [p]
      units.push({
        id: `pair:${p.pairId}`,
        members,
        skillTotal: members.reduce((sum, m) => sum + skillScore(m.skillLevel), 0),
        preferGender: unitPreferGender(members),
        poolGender: unitPoolGender(members),
      })
      continue
    }
    units.push({
      id: `solo:${p.id}`,
      members: [p],
      skillTotal: skillScore(p.skillLevel),
      preferGender: unitPreferGender([p]),
      poolGender: unitPoolGender([p]),
    })
  }

  return units
}

function sortUnitsBySkillDesc(units: DraftUnit[]): DraftUnit[] {
  return [...units].sort((a, b) => {
    const skillDiff = b.skillTotal - a.skillTotal
    if (skillDiff !== 0) return skillDiff
    return a.id.localeCompare(b.id)
  })
}

/** Fisher–Yates shuffle within equal-skill bands (list already skill-sorted). */
function shuffleEqualSkillBands(
  units: DraftUnit[],
  random: () => number
): DraftUnit[] {
  const result = [...units]
  let i = 0
  while (i < result.length) {
    let j = i + 1
    const skill = result[i].skillTotal
    while (j < result.length && result[j].skillTotal === skill) {
      j++
    }
    for (let k = j - 1; k > i; k--) {
      const r = i + Math.floor(random() * (k - i + 1))
      const tmp = result[k]
      result[k] = result[r]
      result[r] = tmp
    }
    i = j
  }
  return result
}

/** Fixed random permutation used as stable tie-break ranks for teams. */
function teamTieBreakRanks(n: number, random: () => number): number[] {
  const order = Array.from({ length: n }, (_, i) => i)
  for (let k = n - 1; k > 0; k--) {
    const r = Math.floor(random() * (k + 1))
    const tmp = order[k]
    order[k] = order[r]
    order[r] = tmp
  }
  const ranks = Array.from({ length: n }, () => 0)
  for (let rank = 0; rank < n; rank++) {
    ranks[order[rank]] = rank
  }
  return ranks
}

/**
 * Auto-seed teams: gender-balanced (W/NB/O vs men), skill-aware snake draft.
 * Paired players (shared pairId) are placed on the same team as one unit.
 * Returns map of player id → team number (1..teamCount). Unset gender players
 * are placed last into the currently smallest / lowest-score teams.
 */
export function autoSeedDraftGroups(
  players: DraftSeedPlayer[],
  teamCount: number,
  options?: AutoSeedOptions
): Map<string, number> {
  const n = Math.max(1, Math.floor(teamCount))
  const assignments = new Map<string, number>()
  const shuffle = options?.shuffle === true
  const random = options?.random ?? Math.random

  if (players.length === 0) return assignments

  const units = buildDraftUnits(players)
  const pools: Record<GenderGroup, DraftUnit[]> = {
    w_nb_o: [],
    men: [],
    unset: [],
  }
  for (const unit of units) {
    pools[unit.poolGender].push(unit)
  }
  for (const key of Object.keys(pools) as GenderGroup[]) {
    const sorted = sortUnitsBySkillDesc(pools[key])
    pools[key] = shuffle ? shuffleEqualSkillBands(sorted, random) : sorted
  }

  const teamSizes = Array.from({ length: n }, () => 0)
  const teamScores = Array.from({ length: n }, () => 0)
  const teamGender = Array.from({ length: n }, () => ({ w_nb_o: 0, men: 0 }))
  const tieBreak = shuffle
    ? teamTieBreakRanks(n, random)
    : Array.from({ length: n }, (_, i) => i)

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
      // then lower skill total, then lower tie-break rank (stable or shuffled).
      const key: [number, number, number, number] = [
        teamSizes[i],
        genderImbalance,
        teamScores[i],
        tieBreak[i],
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

  function assignUnit(unit: DraftUnit, teamIndex: number) {
    const team = teamIndex + 1
    for (const member of unit.members) {
      assignments.set(member.id, team)
      const g = genderGroup(member.gender)
      if (g === 'w_nb_o') teamGender[teamIndex].w_nb_o++
      else if (g === 'men') teamGender[teamIndex].men++
    }
    teamSizes[teamIndex] += unit.members.length
    teamScores[teamIndex] += unit.skillTotal
  }

  // Interleave W/NB/O and men by skill (snake-style via pickTeam heuristics).
  const primary = pools.w_nb_o
  const secondary = pools.men
  let i = 0
  let j = 0
  let takePrimary = primary.length >= secondary.length

  while (i < primary.length || j < secondary.length) {
    if (takePrimary && i < primary.length) {
      assignUnit(primary[i++], pickTeam('w_nb_o'))
    } else if (!takePrimary && j < secondary.length) {
      assignUnit(secondary[j++], pickTeam('men'))
    } else if (i < primary.length) {
      assignUnit(primary[i++], pickTeam('w_nb_o'))
    } else if (j < secondary.length) {
      assignUnit(secondary[j++], pickTeam('men'))
    }
    takePrimary = !takePrimary
  }

  for (const unit of pools.unset) {
    assignUnit(unit, pickTeam(null))
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

/** Build assignment map stats for snapshot compare UI. */
export function summarizeDraftAssignments(
  registrations: Array<{
    id: string
    skillLevel: number | null
    gender: string | null
  }>,
  assignments: Map<string, number | null> | Record<string, number | null>,
  teamCount: number
): {
  unassigned: number
  teams: Array<{
    team: number
    size: number
    skillTotal: number
    skillAvg: number
    gender: { wNbO: number; men: number; unset: number }
  }>
} {
  const get =
    assignments instanceof Map
      ? (id: string) => assignments.get(id) ?? null
      : (id: string) => assignments[id] ?? null

  const byTeam = new Map<number | null, typeof registrations>()
  byTeam.set(null, [])
  for (let t = 1; t <= teamCount; t++) byTeam.set(t, [])

  for (const r of registrations) {
    const team = get(r.id)
    const key =
      team != null && team >= 1 && team <= teamCount ? team : null
    const list = byTeam.get(key) ?? []
    list.push(r)
    byTeam.set(key, list)
  }

  const teams = Array.from({ length: teamCount }, (_, i) => {
    const team = i + 1
    const players = byTeam.get(team) ?? []
    const skillTotal = teamSkillTotal(players)
    return {
      team,
      size: players.length,
      skillTotal,
      skillAvg: players.length > 0 ? skillTotal / players.length : 0,
      gender: teamGenderCounts(players),
    }
  })

  return {
    unassigned: (byTeam.get(null) ?? []).length,
    teams,
  }
}
