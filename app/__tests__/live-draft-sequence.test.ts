import { describe, expect, it } from 'vitest'
import {
  defaultTeamOrderFromRegistrations,
  generatePickSequence,
} from '@/app/lib/events/live-draft-sequence'

describe('generatePickSequence', () => {
  const teams = [1, 2, 3, 4]

  it('snake alternates direction each round', () => {
    expect(generatePickSequence('snake', teams, 8, null)).toEqual([
      1, 2, 3, 4, 4, 3, 2, 1,
    ])
  })

  it('linear repeats forward order', () => {
    expect(generatePickSequence('linear', teams, 6, null)).toEqual([
      1, 2, 3, 4, 1, 2,
    ])
  })

  it('custom uses explicit slots', () => {
    expect(generatePickSequence('custom', teams, 3, [2, 2, 1])).toEqual([2, 2, 1])
  })

  it('rejects custom when too short', () => {
    expect(() => generatePickSequence('custom', teams, 3, [1])).toThrow(/custom_slots/)
  })

  it('default team order uses captain teams only', () => {
    expect(
      defaultTeamOrderFromRegistrations([
        { draftGroup: 1, isCaptain: true },
        { draftGroup: 2, isCaptain: false },
        { draftGroup: 3, isCaptain: true },
      ])
    ).toEqual([1, 3])
  })
})
