import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { getPlayerHistory, getPlayerSnapshot } from '@/app/lib/players/queries'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: Ctx) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  const { id } = await context.params
  try {
    const player = await getPlayerSnapshot(id)
    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }
    const history = await getPlayerHistory(id)
    return NextResponse.json({ history })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load history'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
