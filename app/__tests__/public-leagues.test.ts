import { describe, expect, it } from 'vitest'
import { GET } from '@/app/api/public/leagues/route'
import { HOME_LEAGUE_CODES } from '@/app/lib/players/home-league'
import {
  PUBLIC_LEAGUE_FIELD_KEYS,
  PUBLIC_LEAGUE_FORBIDDEN_KEYS,
  assertPublicLeaguePayload,
  listPublicLeagues,
} from '@/app/lib/player-public/leagues'

function collectJsonKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (value === null || typeof value !== 'object') return keys
  if (Array.isArray(value)) {
    for (const item of value) collectJsonKeys(item, keys)
    return keys
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    keys.add(key)
    collectJsonKeys(child, keys)
  }
  return keys
}

describe('public leagues contract', () => {
  it('lists every home league with allowlisted fields only', () => {
    const leagues = listPublicLeagues()
    expect(leagues).toHaveLength(HOME_LEAGUE_CODES.length)
    for (const league of leagues) {
      expect(Object.keys(league).sort()).toEqual([...PUBLIC_LEAGUE_FIELD_KEYS].sort())
      expect(league.logoPath).toMatch(/^\/home-leagues\//)
    }
    assertPublicLeaguePayload(leagues)
  })

  it('GET /api/public/leagues returns JSON without forbidden keys', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = await res.json()
    const keys = collectJsonKeys(body)
    for (const forbidden of PUBLIC_LEAGUE_FORBIDDEN_KEYS) {
      expect(keys.has(forbidden)).toBe(false)
    }
    const leagues = (body as { leagues: unknown[] }).leagues
    expect(leagues.length).toBeGreaterThan(0)
    assertPublicLeaguePayload(leagues)
  })
})
