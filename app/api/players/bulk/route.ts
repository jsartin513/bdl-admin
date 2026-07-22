import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { parseBulkPlayerRequest } from '@/app/lib/players/bulk'
import { bulkUpdatePlayers } from '@/app/lib/players/mutations'

export async function PATCH(request: NextRequest) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { playerIds, patch } = parseBulkPlayerRequest(body)
    const result = await bulkUpdatePlayers(playerIds, patch, {
      actor: session.email,
    })

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to bulk update players'
    const status =
      message.startsWith('Player not found')
        ? 404
        : message.startsWith('Cannot edit a merged player')
          ? 400
          : message.includes('must') ||
              message.startsWith('Invalid') ||
              message.includes('required') ||
              message.includes('non-empty')
            ? 400
            : 500
    return NextResponse.json({ error: message }, { status })
  }
}
