import { describe, expect, it } from 'vitest'
import { parseDraftGroup } from '@/app/lib/events/types'

describe('snapshot assignment parsing via parseDraftGroup', () => {
  it('accepts null and positive teams used in snapshot JSON', () => {
    expect(parseDraftGroup(null)).toBeNull()
    expect(parseDraftGroup(1)).toBe(1)
    expect(parseDraftGroup(4)).toBe(4)
  })

  it('rejects invalid draft groups that snapshots must not store', () => {
    expect(() => parseDraftGroup(0)).toThrow(/positive integer/)
    expect(() => parseDraftGroup(-2)).toThrow(/positive integer/)
  })
})
