import { describe, expect, it } from 'vitest'
import { parseListPlayersSearchParams } from '@/app/api/players/route'

describe('parseListPlayersSearchParams', () => {
  it('defaults eventMatch to registered when eventId is present', () => {
    const opts = parseListPlayersSearchParams(
      new URLSearchParams({
        eventId: '11111111-1111-4111-8111-111111111111',
      })
    )
    expect(opts.eventId).toBe('11111111-1111-4111-8111-111111111111')
    expect(opts.eventMatch).toBe('registered')
    expect(opts.homeLeagues).toBeNull()
  })

  it('parses eventMatch=not_registered', () => {
    const opts = parseListPlayersSearchParams(
      new URLSearchParams({
        eventId: '11111111-1111-4111-8111-111111111111',
        eventMatch: 'not_registered',
      })
    )
    expect(opts.eventMatch).toBe('not_registered')
  })

  it('ignores invalid eventId values', () => {
    const opts = parseListPlayersSearchParams(
      new URLSearchParams({ eventId: 'not-a-uuid', eventMatch: 'not_registered' })
    )
    expect(opts.eventId).toBeNull()
    expect(opts.eventMatch).toBe('not_registered')
  })

  it('parses comma-separated homeLeagues and drops invalid codes', () => {
    const opts = parseListPlayersSearchParams(
      new URLSearchParams({
        homeLeagues:
          'boston_dodgeball_league,nutmeg_dodgeball,not_a_league,philly_dodgeball',
      })
    )
    expect(opts.homeLeagues).toEqual([
      'boston_dodgeball_league',
      'nutmeg_dodgeball',
      'philly_dodgeball',
    ])
  })

  it('keeps singular homeLeague alongside multi homeLeagues', () => {
    const opts = parseListPlayersSearchParams(
      new URLSearchParams({
        homeLeague: 'unset',
        homeLeagues: 'boston_dodgeball_league',
      })
    )
    expect(opts.homeLeague).toBe('unset')
    expect(opts.homeLeagues).toEqual(['boston_dodgeball_league'])
  })

  it('returns empty homeLeagues array when all codes are invalid', () => {
    const opts = parseListPlayersSearchParams(
      new URLSearchParams({ homeLeagues: 'nope,also_nope' })
    )
    expect(opts.homeLeagues).toEqual([])
  })
})
