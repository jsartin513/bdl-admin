import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { pullAndApplyPlayerAppChanges } from '@/app/lib/players/player-app-sync'

export async function POST(request: NextRequest) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const body = (await request.json().catch(() => ({}))) as { since?: string | null }
    const since =
      typeof body.since === 'string' && body.since.trim() ? body.since.trim() : null

    const result = await pullAndApplyPlayerAppChanges(since)
    if (!result.configured) {
      return NextResponse.json(
        {
          error:
            'Player sync is not configured (set PLAYER_APP_BASE_URL and PLAYER_SYNC_SECRET)',
        },
        { status: 503 }
      )
    }

    return NextResponse.json({
      applied: result.applied,
      skipped: result.skipped,
      ambiguous: result.ambiguous,
      errors: result.errors,
      cursor: result.cursor,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Player sync failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
