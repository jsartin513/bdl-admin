import { describe, expect, it } from 'vitest'
import { GET } from '@/app/api/public/leagues/route'
import { HOME_LEAGUE_CODES } from '@/app/lib/players/home-league'
import {
  assertPublicLeagueCatalogPayload,
  type PublicLeagueCatalogResponse,
} from '@/app/lib/player-public/catalog'
import {
  PUBLIC_LEAGUE_PRODUCT_FIELD_KEYS,
  PUBLIC_LEAGUE_PRODUCT_FORBIDDEN_KEYS,
  assertPublicLeagueProductPayload,
  listPublicLeagueProducts,
  mapEventRowToPublicLeagueProduct,
} from '@/app/lib/player-public/league-products'
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

  it('maps event rows to allowlisted public products', () => {
    const product = mapEventRowToPublicLeagueProduct({
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Spring BYOT',
      eventDate: '2026-04-01',
      eventEndDate: '2026-06-15',
      sessionTimeLabel: 'Wednesdays 7–9 PM',
      location: 'Cambridge Rindge',
      eventFormat: 'byot',
      priceCents: 8500,
      capacity: 48,
      registrationOpensAt: new Date('2026-03-01T12:00:00.000Z'),
      registrationClosesAt: new Date('2026-03-28T23:59:59.000Z'),
      publicDescription: 'Eight-week foam league.',
    })
    expect(Object.keys(product).sort()).toEqual([...PUBLIC_LEAGUE_PRODUCT_FIELD_KEYS].sort())
    expect(product.startDate).toBe('2026-04-01')
    expect(product.format).toBe('byot')
    assertPublicLeagueProductPayload([product])
  })

  it('listPublicLeagueProducts returns an array without DB', async () => {
    const products = await listPublicLeagueProducts()
    expect(Array.isArray(products)).toBe(true)
  })

  it('GET /api/public/leagues returns JSON without forbidden keys', async () => {
    const res = await GET()
    expect(res.status).toBe(200)
    const body = (await res.json()) as PublicLeagueCatalogResponse
    expect(body.version).toBe(2)
    expect(Array.isArray(body.products)).toBe(true)

    const keys = collectJsonKeys(body)
    const forbidden = new Set<string>([
      ...PUBLIC_LEAGUE_FORBIDDEN_KEYS,
      ...PUBLIC_LEAGUE_PRODUCT_FORBIDDEN_KEYS,
    ])
    for (const key of forbidden) {
      expect(keys.has(key)).toBe(false)
    }

    expect(body.leagues.length).toBe(HOME_LEAGUE_CODES.length)
    for (const league of body.leagues) {
      expect(Object.keys(league).sort()).toEqual([...PUBLIC_LEAGUE_FIELD_KEYS].sort())
    }
    for (const product of body.products) {
      expect(Object.keys(product).sort()).toEqual([...PUBLIC_LEAGUE_PRODUCT_FIELD_KEYS].sort())
    }
    assertPublicLeagueCatalogPayload(body)
  })
})
