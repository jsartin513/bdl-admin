import { describe, expect, it } from 'vitest'
import { assertTeamNamesPatchWhenLocked } from '@/app/lib/events/team-names'

describe('assertTeamNamesPatchWhenLocked', () => {
  it('allows any change when there are no BYOT groups', () => {
    expect(() =>
      assertTeamNamesPatchWhenLocked(['A', 'B'], ['X', 'Y', 'Z'], [])
    ).not.toThrow()
  })

  it('allows FA append and FA rename when BYOT slots unchanged', () => {
    expect(() =>
      assertTeamNamesPatchWhenLocked(
        ['Alpha', 'Beta', ''],
        ['Alpha', 'Beta', 'Free Agents'],
        [1, 2]
      )
    ).not.toThrow()
  })

  it('rejects renaming a BYOT slot', () => {
    expect(() =>
      assertTeamNamesPatchWhenLocked(
        ['Alpha', 'Beta'],
        ['Altered', 'Beta'],
        [1, 2]
      )
    ).toThrow(/Unlock to edit imported BYOT/)
  })

  it('rejects removing a BYOT slot', () => {
    expect(() =>
      assertTeamNamesPatchWhenLocked(['Alpha', 'Beta', 'FA'], ['Alpha'], [1, 2])
    ).toThrow(/Unlock to edit imported BYOT/)
  })

  it('rejects reordering BYOT slots', () => {
    expect(() =>
      assertTeamNamesPatchWhenLocked(
        ['Alpha', 'Beta'],
        ['Beta', 'Alpha'],
        [1, 2]
      )
    ).toThrow(/Unlock to edit imported BYOT/)
  })
})
