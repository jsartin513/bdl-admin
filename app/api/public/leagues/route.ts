import { NextResponse } from 'next/server'
import {
  assertPublicLeagueCatalogPayload,
  type PublicLeagueCatalogResponse,
} from '@/app/lib/player-public/catalog'
import { listPublicLeagueProducts } from '@/app/lib/player-public/league-products'
import { listPublicLeagues } from '@/app/lib/player-public/leagues'

export const runtime = 'nodejs'

export async function GET() {
  const body: PublicLeagueCatalogResponse = {
    version: 2,
    leagues: listPublicLeagues(),
    products: await listPublicLeagueProducts(),
  }
  assertPublicLeagueCatalogPayload(body)
  return NextResponse.json(body)
}
