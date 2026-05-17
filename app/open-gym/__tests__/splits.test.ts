import { describe, it, expect } from 'vitest'
import { getConfigs, describeConfig, sizeLabel } from '../splits'

describe('getConfigs', () => {
  it('returns empty for out-of-range inputs', () => {
    expect(getConfigs(0)).toEqual([])
    expect(getConfigs(9)).toEqual([])
    expect(getConfigs(49)).toEqual([])
  })

  it('returns valid configs for 10 players (smallest valid count)', () => {
    const configs = getConfigs(10)
    expect(configs.length).toBeGreaterThan(0)
    for (const c of configs) {
      const sizes = [c.baseSize, c.baseSize + 1]
      for (const s of sizes) {
        expect(s).toBeGreaterThanOrEqual(5)
        expect(s).toBeLessThanOrEqual(8)
      }
      expect(c.numTeams * c.baseSize + c.large).toBe(10)
    }
  })

  it('returns valid configs for 24 players (common case)', () => {
    const configs = getConfigs(24)
    expect(configs.length).toBeGreaterThan(0)
    for (const c of configs) {
      expect(c.numTeams * c.baseSize + c.large).toBe(24)
      expect(c.baseSize).toBeGreaterThanOrEqual(5)
      expect(c.baseSize + (c.large > 0 ? 1 : 0)).toBeLessThanOrEqual(8)
    }
  })

  it('prefers 4 teams of 6 for exactly 24 players (ideal split)', () => {
    const configs = getConfigs(24)
    expect(configs[0].numTeams).toBe(4)
    expect(configs[0].baseSize).toBe(6)
    expect(configs[0].large).toBe(0)
  })

  it('prefers teams closer to size 6 for 48 players', () => {
    const configs = getConfigs(48)
    expect(configs.length).toBeGreaterThan(0)
    // 48 / 8 = 6 → 8 teams of 6 is invalid (max 6 teams), best valid is 6×8
    // among 2–6 teams: 48/6=8 → 6 teams of 8; 48/4=12 → invalid; 48/3=16 → invalid
    // 48/5 = 9.6 → invalid; 48/2 = 24 → invalid
    // So only 6 teams of 8 is valid
    expect(configs).toHaveLength(1)
    expect(configs[0].numTeams).toBe(6)
    expect(configs[0].baseSize).toBe(8)
  })

  it('handles uneven splits (30 players)', () => {
    const configs = getConfigs(30)
    expect(configs.length).toBeGreaterThan(0)
    for (const c of configs) {
      expect(c.numTeams * c.baseSize + c.large).toBe(30)
    }
  })

  it('returns configs sorted by score (best first)', () => {
    const configs = getConfigs(24)
    for (let i = 1; i < configs.length; i++) {
      expect(configs[i].score).toBeGreaterThanOrEqual(configs[i - 1].score)
    }
  })
})

describe('describeConfig', () => {
  it('describes an even split', () => {
    const cfg = { numTeams: 4, baseSize: 6, large: 0, small: 4, score: 0 }
    expect(describeConfig(cfg)).toBe('4 teams of 6')
  })

  it('describes an uneven split', () => {
    // 25 players / 4 teams: 1 team of 7, 3 teams of 6
    const cfg = { numTeams: 4, baseSize: 6, large: 1, small: 3, score: 0 }
    expect(describeConfig(cfg)).toBe('1×7 + 3×6')
  })
})

describe('sizeLabel', () => {
  it('returns a clean label for even sizes', () => {
    const cfg = { numTeams: 4, baseSize: 6, large: 0, small: 4, score: 0 }
    expect(sizeLabel(cfg)).toBe('6v6')
  })

  it('returns a range label for uneven sizes', () => {
    const cfg = { numTeams: 4, baseSize: 6, large: 1, small: 3, score: 0 }
    expect(sizeLabel(cfg)).toBe('6–7v6–7')
  })
})
