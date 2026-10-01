import { NextResponse } from 'next/server'
import {
  assertPublicLeaguePayload,
  listPublicLeagues,
} from '@/app/lib/player-public/leagues'

export const runtime = 'nodejs'

export async function GET() {
  const leagues = listPublicLeagues()
  assertPublicLeaguePayload(leagues)
  return NextResponse.json({ leagues })
}
