import { describe, expect, it } from 'vitest'
import {
  ballTypeLabel,
  eventGenderLabel,
  isValidBallType,
  isValidEventGender,
} from '@/app/lib/events/types'

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
