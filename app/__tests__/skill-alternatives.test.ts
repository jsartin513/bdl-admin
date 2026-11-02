import { describe, expect, it } from 'vitest'
import {
  effectiveSkillLabel,
  effectiveSkillScore,
  isValidFibSkillLevel,
  isValidSkillLevel,
  linearSkillBand,
  mergeSkillAreasPatch,
  parseSkillAreas,
  skillLevelLabel,
  skillMatrixBucketKey,
  skillStyleKind,
} from '@/app/lib/players/skill'

describe('linear skill scale', () => {
  it('accepts midpoints on the ×20 scale', () => {
    expect(isValidSkillLevel(30)).toBe(true)
    expect(isValidSkillLevel(20)).toBe(true)
    expect(isValidSkillLevel(0)).toBe(false)
    expect(isValidSkillLevel(101)).toBe(false)
  })

  it('labels anchors and midpoints', () => {
    expect(skillLevelLabel(40)).toBe('Intermediate')
    expect(skillLevelLabel(50)).toBe('50 (Intermediate)')
    expect(linearSkillBand(55)).toBe(40)
    expect(linearSkillBand(10)).toBe(20)
  })
})

describe('fibonacci skill', () => {
  it('validates the allowed fib set', () => {
    expect(isValidFibSkillLevel(13)).toBe(true)
    expect(isValidFibSkillLevel(4)).toBe(false)
  })
})

describe('skill areas', () => {
  it('parses and merges area patches', () => {
    expect(parseSkillAreas({ offense: 60, defense: null })).toEqual({
      offense: 60,
      defense: null,
      stayingAlive: null,
      courtPresence: null,
    })
    expect(
      mergeSkillAreasPatch({ offense: 40, defense: null, stayingAlive: null, courtPresence: null }, {
        defense: 50,
      })
    ).toEqual({
      offense: 40,
      defense: 50,
      stayingAlive: null,
      courtPresence: null,
    })
  })

  it('averages areas with linear fallback', () => {
    const player = {
      skillLevel: 40,
      skillLevelFib: 13,
      skillAreas: {
        offense: 60,
        defense: null,
        stayingAlive: 20,
        courtPresence: null,
      },
    }
    // (60 + 40 + 20 + 40) / 4 = 40
    expect(effectiveSkillScore(player, 'areas')).toBe(40)
    expect(effectiveSkillScore(player, 'linear')).toBe(40)
    expect(effectiveSkillScore(player, 'fibonacci')).toBe(13)
    expect(effectiveSkillLabel(player, 'fibonacci')).toBe('13')
  })

  it('returns null when linear and areas are unset', () => {
    expect(
      effectiveSkillScore({ skillLevel: null, skillLevelFib: null, skillAreas: null }, 'areas')
    ).toBeNull()
  })
})

describe('matrix and style helpers', () => {
  it('buckets midpoints into anchors', () => {
    expect(skillMatrixBucketKey(50, 'linear')).toBe('40')
    expect(skillMatrixBucketKey(13, 'fibonacci')).toBe('13')
    expect(skillMatrixBucketKey(null, 'areas')).toBe('unset')
  })

  it('styles by mode thresholds', () => {
    expect(skillStyleKind(20, 'linear')).toBe('beginner')
    expect(skillStyleKind(60, 'linear')).toBe('advanced')
    expect(skillStyleKind(80, 'linear')).toBe('worlds')
    expect(skillStyleKind(2, 'fibonacci')).toBe('beginner')
    expect(skillStyleKind(55, 'fibonacci')).toBe('worlds')
  })
})
