import { describe, expect, it } from 'vitest'
import {
  autoSeedDraftGroups,
  copyExistingDraftGroups,
  defaultTeamCount,
  emptySeedDraftGroups,
  playersPerTeamLabel,
  teamGenderCounts,
  teamSkillTotal,
  type DraftSeedPlayer,
} from '@/app/lib/events/draft-seed'

function player(
  id: string,
  skillLevel: number | null,
  gender: string | null
): DraftSeedPlayer {
  return { id, skillLevel, gender }
}

/** Deterministic PRNG for shuffle tests (mulberry32). */
function mulberry32(seed: number): () => number {
  let t = seed >>> 0
  return () => {
    t = (t + 0x6d2b79f5) >>> 0
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

describe('playersPerTeamLabel', () => {
  it('shows a single size when even', () => {
    expect(playersPerTeamLabel(14, 2)).toBe('7')
    expect(playersPerTeamLabel(0, 2)).toBe('0')
  })

  it('shows a range when uneven', () => {
    expect(playersPerTeamLabel(15, 2)).toBe('7–8')
    expect(playersPerTeamLabel(22, 3)).toBe('7–8')
  })
})

describe('defaultTeamCount', () => {
  it('targets roughly 7–8 players per team', () => {
    expect(defaultTeamCount(0)).toBe(1)
    expect(defaultTeamCount(7)).toBe(1)
    expect(defaultTeamCount(8)).toBe(1)
    expect(defaultTeamCount(15)).toBe(2)
    expect(defaultTeamCount(56)).toBe(7)
    expect(defaultTeamCount(60)).toBe(8)
  })

  it('prefers 6 over 9', () => {
    expect(defaultTeamCount(18)).toBe(3) // 3×6, not 2×9
  })
})

describe('autoSeedDraftGroups', () => {
  it('assigns every player to a team 1..N', () => {
    const players = [
      player('a', 4, 'woman'),
      player('b', 3, 'man'),
      player('c', 2, 'woman'),
      player('d', 1, 'man'),
      player('e', 3, 'nonbinary'),
      player('f', 2, 'man'),
    ]
    const result = autoSeedDraftGroups(players, 2)
    expect(result.size).toBe(6)
    for (const team of result.values()) {
      expect(team).toBeGreaterThanOrEqual(1)
      expect(team).toBeLessThanOrEqual(2)
    }
  })

  it('keeps team sizes within 1 of each other', () => {
    const players = Array.from({ length: 20 }, (_, i) =>
      player(
        `p${i}`,
        (i % 4) + 1,
        i % 2 === 0 ? 'woman' : 'man'
      )
    )
    const teamCount = 3
    const result = autoSeedDraftGroups(players, teamCount)
    const sizes = Array.from({ length: teamCount }, () => 0)
    for (const team of result.values()) {
      sizes[team - 1]++
    }
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1)
  })

  it('spreads gender groups across teams', () => {
    const players = [
      ...Array.from({ length: 6 }, (_, i) => player(`w${i}`, 3, 'woman')),
      ...Array.from({ length: 6 }, (_, i) => player(`m${i}`, 3, 'man')),
    ]
    const result = autoSeedDraftGroups(players, 3)
    const byTeam = Array.from({ length: 3 }, () =>
      [] as DraftSeedPlayer[]
    )
    for (const p of players) {
      const team = result.get(p.id)!
      byTeam[team - 1].push(p)
    }
    for (const teamPlayers of byTeam) {
      const { wNbO, men } = teamGenderCounts(teamPlayers)
      expect(Math.abs(wNbO - men)).toBeLessThanOrEqual(1)
    }
  })

  it('balances skill totals across teams', () => {
    const players = [
      player('a', 4, 'woman'),
      player('b', 4, 'man'),
      player('c', 1, 'woman'),
      player('d', 1, 'man'),
      player('e', 3, 'woman'),
      player('f', 3, 'man'),
      player('g', 2, 'woman'),
      player('h', 2, 'man'),
    ]
    const result = autoSeedDraftGroups(players, 2)
    const teams = [[], []] as DraftSeedPlayer[][]
    for (const p of players) {
      teams[result.get(p.id)! - 1].push(p)
    }
    const scores = teams.map(teamSkillTotal)
    expect(Math.abs(scores[0] - scores[1])).toBeLessThanOrEqual(2)
  })

  it('places unset gender into teams without crashing', () => {
    const players = [
      player('a', 3, null),
      player('b', 2, 'man'),
      player('c', 4, 'woman'),
    ]
    const result = autoSeedDraftGroups(players, 2)
    expect(result.size).toBe(3)
  })

  it('can produce different layouts when shuffled with different seeds', () => {
    const players = Array.from({ length: 16 }, (_, i) =>
      player(
        `p${i}`,
        (i % 4) + 1,
        i % 2 === 0 ? 'woman' : 'man'
      )
    )
    const a = autoSeedDraftGroups(players, 2, {
      shuffle: true,
      random: mulberry32(1),
    })
    const b = autoSeedDraftGroups(players, 2, {
      shuffle: true,
      random: mulberry32(99),
    })
    const same = [...a.entries()].every(([id, team]) => b.get(id) === team)
    expect(same).toBe(false)
  })

  it('is deterministic when shuffle is off', () => {
    const players = Array.from({ length: 12 }, (_, i) =>
      player(`p${i}`, (i % 3) + 1, i % 2 === 0 ? 'woman' : 'man')
    )
    const a = autoSeedDraftGroups(players, 3)
    const b = autoSeedDraftGroups(players, 3)
    expect([...a.entries()]).toEqual([...b.entries()])
  })
})

describe('emptySeedDraftGroups', () => {
  it('marks everyone unassigned', () => {
    const players = [player('a', 1, 'man'), player('b', 2, 'woman')]
    const result = emptySeedDraftGroups(players)
    expect(result.get('a')).toBeNull()
    expect(result.get('b')).toBeNull()
  })
})

describe('copyExistingDraftGroups', () => {
  it('copies permanent draft groups into the workspace map', () => {
    const result = copyExistingDraftGroups([
      { id: 'a', skillLevel: 1, gender: 'man', draftGroup: 2 },
      { id: 'b', skillLevel: 2, gender: 'woman', draftGroup: null },
    ])
    expect(result.get('a')).toBe(2)
    expect(result.get('b')).toBeNull()
  })
})
