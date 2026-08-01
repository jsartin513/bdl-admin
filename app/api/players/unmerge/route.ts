import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { unmergePlayer } from '@/app/lib/players/merge'

export async function POST(request: NextRequest) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const body = (await request.json()) as { playerId?: string }

    if (!body.playerId?.trim()) {
      return NextResponse.json({ error: 'playerId is required' }, { status: 400 })
    }

    const result = await unmergePlayer({
      playerId: body.playerId.trim(),
      actor: session.email,
    })

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unmerge failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
