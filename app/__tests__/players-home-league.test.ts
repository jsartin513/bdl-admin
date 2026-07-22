import { describe, expect, it } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  HOME_LEAGUES,
  HOME_LEAGUE_CODES,
  homeLeagueLabel,
  homeLeagueLogoUrl,
  isValidHomeLeague,
} from '@/app/lib/players/home-league'

describe('home league enum', () => {
  it('includes the expected catalog size', () => {
    expect(HOME_LEAGUE_CODES).toHaveLength(20)
    expect(Object.keys(HOME_LEAGUES)).toHaveLength(20)
  })

  it('validates known codes and rejects unknown values', () => {
    expect(isValidHomeLeague('boston_dodgeball_league')).toBe(true)
    expect(isValidHomeLeague('nutmeg_dodgeball')).toBe(true)
    expect(isValidHomeLeague('connecticut_dodgeball')).toBe(true)
    expect(isValidHomeLeague('Boston Dodgeball League')).toBe(false)
    expect(isValidHomeLeague('')).toBe(false)
    expect(isValidHomeLeague(null)).toBe(false)
  })

  it('returns display labels for valid codes', () => {
    expect(homeLeagueLabel('boston_dodgeball_league')).toBe('Boston Dodgeball League')
    expect(homeLeagueLabel('cactus_dodgeball')).toBe('Cactus Dodgeball (Arizona)')
    expect(homeLeagueLabel('unknown')).toBe('—')
    expect(homeLeagueLabel(null)).toBe('—')
  })

  it('maps every catalog code to a local logo asset', () => {
    for (const code of HOME_LEAGUE_CODES) {
      expect(homeLeagueLogoUrl(code)).toBe(`/home-leagues/${code}.webp`)
      expect(
        existsSync(resolve(process.cwd(), 'public', 'home-leagues', `${code}.webp`))
      ).toBe(true)
    }
    expect(homeLeagueLogoUrl('not-a-league')).toBeNull()
  })
})
