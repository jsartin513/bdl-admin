import { NextRequest, NextResponse } from 'next/server'
import { authorizeCron } from '@/app/lib/schedule/cron-auth'
import { pullAndApplyPlayerAppChanges } from '@/app/lib/players/player-app-sync'

export const runtime = 'nodejs'
/** Hobby plan caps serverless functions at 60s (see Vercel limits). */
export const maxDuration = 60

async function runPlayerSyncCron() {
  const result = await pullAndApplyPlayerAppChanges(null)
  if (!result.configured) {
    return NextResponse.json({
      skipped: true,
      reason: 'player sync not configured (PLAYER_APP_BASE_URL and PLAYER_SYNC_SECRET)',
    })
  }

  return NextResponse.json({
    applied: result.applied,
    skipped: result.skipped,
    ambiguous: result.ambiguous,
    errors: result.errors,
    cursor: result.cursor,
  })
}

export async function GET(request: NextRequest) {
  const auth = authorizeCron(request)
  if (auth) return auth
  try {
    return await runPlayerSyncCron()
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Player sync failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
