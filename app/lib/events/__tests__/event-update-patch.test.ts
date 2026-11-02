import { describe, expect, it } from 'vitest'
import {
  EVENT_UPDATE_PATCH_KEYS,
  parseEventUpdatePatch,
} from '@/app/lib/events/event-update-patch'
import { PUBLIC_LEAGUE_PRODUCT_FORBIDDEN_KEYS } from '@/app/lib/player-public/league-products'

describe('parseEventUpdatePatch', () => {
  it('allowlists every accepted PATCH key', () => {
    expect(EVENT_UPDATE_PATCH_KEYS).toContain('publishedToPlayerApp')
    expect(EVENT_UPDATE_PATCH_KEYS).toContain('publicDescription')
    expect(EVENT_UPDATE_PATCH_KEYS).toContain('location')
    expect(EVENT_UPDATE_PATCH_KEYS).toContain('sessionTimeLabel')
    expect(EVENT_UPDATE_PATCH_KEYS).toContain('priceCents')
    expect(EVENT_UPDATE_PATCH_KEYS).toContain('capacity')
    expect(EVENT_UPDATE_PATCH_KEYS).toContain('registrationOpensAt')
    expect(EVENT_UPDATE_PATCH_KEYS).toContain('registrationClosesAt')
    expect(EVENT_UPDATE_PATCH_KEYS).toContain('eventEndDate')
    expect(EVENT_UPDATE_PATCH_KEYS).toContain('notes')
  })

  it('rejects unknown fields', () => {
    expect(() =>
      parseEventUpdatePatch({ name: 'Test', secretStaffNotes: 'nope' })
    ).toThrow(/Unknown field/)
  })

  it('parses player catalog fields', () => {
    const patch = parseEventUpdatePatch({
      publishedToPlayerApp: true,
      publicDescription: ' Spring league ',
      location: 'Cambridge',
      sessionTimeLabel: 'Wednesdays',
      priceCents: 8500,
      capacity: 48,
      registrationOpensAt: '2026-03-01T12:00:00.000Z',
      registrationClosesAt: null,
      eventEndDate: '2026-06-15',
    })
    expect(patch.publishedToPlayerApp).toBe(true)
    expect(patch.publicDescription).toBe('Spring league')
    expect(patch.location).toBe('Cambridge')
    expect(patch.priceCents).toBe(8500)
    expect(patch.capacity).toBe(48)
    expect(patch.registrationOpensAt?.toISOString()).toBe(
      '2026-03-01T12:00:00.000Z'
    )
    expect(patch.registrationClosesAt).toBeNull()
    expect(patch.eventEndDate).toBe('2026-06-15')
  })

  it('keeps staff notes on admin patch only; notes stay off public product contract', () => {
    const patch = parseEventUpdatePatch({ notes: 'Board-only reminder' })
    expect(patch.notes).toBe('Board-only reminder')
    expect(PUBLIC_LEAGUE_PRODUCT_FORBIDDEN_KEYS).toContain('notes')
  })
})
