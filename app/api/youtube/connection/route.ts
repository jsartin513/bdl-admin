import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import {
  deleteYoutubeConnection,
  getYoutubeConnectionPublic,
} from '@/app/lib/youtube/connection'
import { clearYoutubeAccessTokenCache } from '@/app/lib/youtube/client'

export async function GET(request: NextRequest) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const connection = await getYoutubeConnectionPublic()
    return NextResponse.json({ connection })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to load YouTube connection'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    await deleteYoutubeConnection()
    clearYoutubeAccessTokenCache()
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to disconnect YouTube'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
