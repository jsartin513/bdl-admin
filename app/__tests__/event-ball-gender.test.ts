import { describe, expect, it } from 'vitest'
import {
  ballTypeLabel,
  eventFormatLabel,
  eventGenderLabel,
  eventTypeLabel,
  isValidBallType,
  isValidEventFormat,
  isValidEventGender,
  isValidEventType,
  parseEventFormat,
} from '@/app/lib/events/types'

describe('event type', () => {
  it('accepts tournament, league, open_gym, and other', () => {
    expect(isValidEventType('tournament')).toBe(true)
    expect(isValidEventType('league')).toBe(true)
    expect(isValidEventType('open_gym')).toBe(true)
    expect(isValidEventType('other')).toBe(true)
    expect(isValidEventType('clinic')).toBe(false)
  })

  it('labels known values and defaults unknown to Other', () => {
    expect(eventTypeLabel('league')).toBe('League')
    expect(eventTypeLabel('nope')).toBe('Other')
  })
})

describe('event format', () => {
  it('accepts byot, remix, and draft', () => {
    expect(isValidEventFormat('byot')).toBe(true)
    expect(isValidEventFormat('remix')).toBe(true)
    expect(isValidEventFormat('draft')).toBe(true)
    expect(isValidEventFormat('hybrid')).toBe(false)
  })

  it('parses empty to null and rejects invalid', () => {
    expect(parseEventFormat(undefined)).toBeUndefined()
    expect(parseEventFormat(null)).toBeNull()
    expect(parseEventFormat('')).toBeNull()
    expect(parseEventFormat('byot')).toBe('byot')
    expect(() => parseEventFormat('hybrid')).toThrow('Invalid eventFormat')
  })

  it('labels known values and returns null for unset', () => {
    expect(eventFormatLabel('byot')).toBe('BYOT')
    expect(eventFormatLabel('remix')).toBe('Remix')
    expect(eventFormatLabel('draft')).toBe('Draft')
    expect(eventFormatLabel(null)).toBeNull()
    expect(eventFormatLabel('nope')).toBeNull()
  })
})

describe('event ball type', () => {
  it('accepts foam and cloth', () => {
    expect(isValidBallType('foam')).toBe(true)
    expect(isValidBallType('cloth')).toBe(true)
    expect(isValidBallType('rubber')).toBe(false)
  })

  it('labels known values and defaults unknown to Foam', () => {
    expect(ballTypeLabel('foam')).toBe('Foam')
    expect(ballTypeLabel('cloth')).toBe('Cloth')
    expect(ballTypeLabel('nope')).toBe('Foam')
  })
})

describe('event gender', () => {
  it('accepts mixed, open, and she_they', () => {
    expect(isValidEventGender('mixed')).toBe(true)
    expect(isValidEventGender('open')).toBe(true)
    expect(isValidEventGender('she_they')).toBe(true)
    expect(isValidEventGender('women')).toBe(false)
  })

  it('labels known values and defaults unknown to Mixed', () => {
    expect(eventGenderLabel('mixed')).toBe('Mixed')
    expect(eventGenderLabel('open')).toBe('Open')
    expect(eventGenderLabel('she_they')).toBe('She/they')
    expect(eventGenderLabel('nope')).toBe('Mixed')
  })
})
