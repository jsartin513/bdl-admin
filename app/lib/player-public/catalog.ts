import {
  assertPublicLeagueProductPayload,
  type PublicLeagueProduct,
} from '@/app/lib/player-public/league-products'
import { assertPublicLeaguePayload, type PublicLeague } from '@/app/lib/player-public/leagues'

/** Response shape for `GET /api/public/leagues`. */
export type PublicLeagueCatalogResponse = {
  /** Increment when the top-level contract changes. */
  version: 2
  /**
   * Static home-league branding catalog (legacy player app field).
   * Prefer `products` for registration SKUs.
   */
  leagues: PublicLeague[]
  /** Published operational events exposed as sellable league products. */
  products: PublicLeagueProduct[]
}

export function assertPublicLeagueCatalogPayload(value: unknown): void {
  if (value === null || typeof value !== 'object') {
    throw new Error('Public league catalog must be an object')
  }
  const record = value as Record<string, unknown>
  if (!Array.isArray(record.leagues)) {
    throw new Error('Public league catalog missing leagues array')
  }
  if (!Array.isArray(record.products)) {
    throw new Error('Public league catalog missing products array')
  }
  assertPublicLeaguePayload(record.leagues)
  assertPublicLeagueProductPayload(record.products)
}
