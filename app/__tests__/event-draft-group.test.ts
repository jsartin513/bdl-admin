import { describe, expect, it } from 'vitest'
import {
  isValidDraftGroup,
  parseDraftGroup,
} from '@/app/lib/events/types'
import { parseEventDate } from '@/app/lib/events/mutations'

describe('parseDraftGroup', () => {
  it('accepts positive integers and null to clear', () => {
    expect(parseDraftGroup(1)).toBe(1)
    expect(parseDraftGroup('3')).toBe(3)
    expect(parseDraftGroup(null)).toBeNull()
    expect(parseDraftGroup('')).toBeNull()
    expect(parseDraftGroup(undefined)).toBeUndefined()
  })

  it('rejects zero, negatives, and non-integers', () => {
    expect(() => parseDraftGroup(0)).toThrow(/positive integer/)
    expect(() => parseDraftGroup(-1)).toThrow(/positive integer/)
    expect(() => parseDraftGroup(1.5)).toThrow(/positive integer/)
    expect(() => parseDraftGroup('nope')).toThrow(/positive integer/)
  })

  it('isValidDraftGroup mirrors parse rules', () => {
    expect(isValidDraftGroup(2)).toBe(true)
    expect(isValidDraftGroup(null)).toBe(true)
    expect(isValidDraftGroup(0)).toBe(false)
    expect(isValidDraftGroup(undefined)).toBe(false)
  })
})

describe('parseEventDate', () => {
  it('accepts valid calendar dates', () => {
    expect(parseEventDate('2026-08-08')).toBe('2026-08-08')
    expect(parseEventDate(' 2026-02-28 ')).toBe('2026-02-28')
  })

  it('rejects malformed and overflow calendar dates', () => {
    expect(() => parseEventDate('08/08/2026')).toThrow(/YYYY-MM-DD/)
    expect(() => parseEventDate('2026-02-31')).toThrow(/not a valid date/)
    expect(() => parseEventDate('2026-13-01')).toThrow(/not a valid date/)
  })
})
