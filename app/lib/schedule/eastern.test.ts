import { describe, expect, it } from 'vitest'
import { easternLocalToDate, formatEasternLocal, parseScheduledRunAt } from '@/app/lib/schedule/eastern'

describe('schedule eastern', () => {
  it('round-trips a local datetime', () => {
    const sample = '2026-10-15T14:30'
    const date = easternLocalToDate(sample)
    expect(date).not.toBeNull()
    expect(formatEasternLocal(date!)).toBe(sample)
  })

  it('requires runAt at least one minute ahead', () => {
    const soon = formatEasternLocal(new Date(Date.now() + 30_000))
    expect(() => parseScheduledRunAt(soon)).toThrow(/minute/)
  })
})
