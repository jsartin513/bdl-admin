import { NextRequest, NextResponse } from 'next/server'
import { readPlayerAppSyncConfig } from '@/app/lib/players/player-app-sync'

export const PLAYER_SYNC_HEADER = 'x-bdl-player-sync-secret'

export type InternalPlayerIdentity = {
  email: string
  accountId: string | null
}

export function unauthorizedInternal(message = 'Unauthorized'): NextResponse {
  return NextResponse.json({ error: message }, { status: 401 })
}

export function readInternalPlayerIdentity(
  request: NextRequest
): InternalPlayerIdentity | NextResponse {
  const config = readPlayerAppSyncConfig()
  if (!config) {
    return NextResponse.json(
      { error: 'Player sync is not configured (PLAYER_SYNC_SECRET)' },
      { status: 503 }
    )
  }

  const secret = request.headers.get(PLAYER_SYNC_HEADER)?.trim()
  if (!secret || secret !== config.secret) {
    return unauthorizedInternal()
  }

  const email = request.headers.get('x-bdl-player-email')?.trim().toLowerCase()
  if (!email) {
    return NextResponse.json({ error: 'x-bdl-player-email header is required' }, { status: 400 })
  }

  const accountId = request.headers.get('x-bdl-player-account-id')?.trim() || null
  return { email, accountId }
}

export function isInternalAuthError(
  value: InternalPlayerIdentity | NextResponse
): value is NextResponse {
  return value instanceof NextResponse
}
