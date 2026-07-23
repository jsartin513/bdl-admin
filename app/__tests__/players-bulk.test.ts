import { describe, expect, it } from 'vitest'
import {
  bulkPatchHasCoreFields,
  parseBulkPlayerRequest,
  type BulkPlayerPatch,
} from '@/app/lib/players/bulk'

describe('parseBulkPlayerRequest', () => {
  it('accepts a gender-only patch and dedupes player ids', () => {
    const parsed = parseBulkPlayerRequest({
      playerIds: ['a', 'b', 'a'],
      patch: { gender: 'female' },
    })
    expect(parsed.playerIds).toEqual(['a', 'b'])
    expect(parsed.patch).toEqual({ gender: 'female' })
  })

  it('accepts clearing gender and skill to null', () => {
    const parsed = parseBulkPlayerRequest({
      playerIds: ['p1'],
      patch: { gender: null, skillLevel: null },
    })
    expect(parsed.patch).toEqual({ gender: null, skillLevel: null })
  })

  it('accepts home-league add and remove by code', () => {
    const parsed = parseBulkPlayerRequest({
      playerIds: ['p1'],
      patch: {
        addHomeLeague: 'boston_dodgeball_league',
        removeHomeLeague: 'nutmeg_dodgeball',
      },
    })
    expect(parsed.patch.addHomeLeague).toBe('boston_dodgeball_league')
    expect(parsed.patch.removeHomeLeague).toBe('nutmeg_dodgeball')
  })

  it('requires notes when enabling strong personality', () => {
    expect(() =>
      parseBulkPlayerRequest({
        playerIds: ['p1'],
        patch: { hasStrongPersonality: true },
      })
    ).toThrow(/strongPersonalityNotes are required/)

    expect(() =>
      parseBulkPlayerRequest({
        playerIds: ['p1'],
        patch: { hasStrongPersonality: true, strongPersonalityNotes: '   ' },
      })
    ).toThrow(/strongPersonalityNotes are required/)

    const ok = parseBulkPlayerRequest({
      playerIds: ['p1'],
      patch: {
        hasStrongPersonality: true,
        strongPersonalityNotes: ' Needs clear communication ',
      },
    })
    expect(ok.patch.strongPersonalityNotes).toBe('Needs clear communication')
  })

  it('rejects empty playerIds, empty patch, and invalid enums', () => {
    expect(() => parseBulkPlayerRequest({ playerIds: [], patch: { gender: 'female' } })).toThrow(
      /playerIds must be a non-empty array/
    )
    expect(() => parseBulkPlayerRequest({ playerIds: ['p1'], patch: {} })).toThrow(
      /at least one field/
    )
    expect(() =>
      parseBulkPlayerRequest({ playerIds: ['p1'], patch: { gender: 'alien' } })
    ).toThrow(/Invalid gender/)
    expect(() =>
      parseBulkPlayerRequest({ playerIds: ['p1'], patch: { skillLevel: 9 } })
    ).toThrow(/Invalid skill level/)
    expect(() =>
      parseBulkPlayerRequest({
        playerIds: ['p1'],
        patch: { addHomeLeague: 'Boston Dodgeball League' },
      })
    ).toThrow(/Invalid addHomeLeague/)
    expect(() =>
      parseBulkPlayerRequest({
        playerIds: ['p1'],
        patch: { removeHomeLeague: 'not-a-league' },
      })
    ).toThrow(/Invalid removeHomeLeague/)
  })
})

describe('bulkPatchHasCoreFields', () => {
  it('detects scalar fields vs home-league-only patches', () => {
    expect(bulkPatchHasCoreFields({ gender: 'male' })).toBe(true)
    expect(bulkPatchHasCoreFields({ addHomeLeague: 'boston_dodgeball_league' })).toBe(false)
    const empty: BulkPlayerPatch = {}
    expect(bulkPatchHasCoreFields(empty)).toBe(false)
  })
})
