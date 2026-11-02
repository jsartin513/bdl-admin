import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { createPlaylist, listChannelPlaylists } from '@/app/lib/youtube/client'
import { getYoutubeConnectionPublic } from '@/app/lib/youtube/connection'

export async function GET(request: NextRequest) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const connection = await getYoutubeConnectionPublic()
    if (!connection) {
      return NextResponse.json(
        { error: 'YouTube channel is not connected' },
        { status: 400 }
      )
    }
    const playlists = await listChannelPlaylists()
    return NextResponse.json({ playlists, connection })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to list playlists'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function POST(request: NextRequest) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const connection = await getYoutubeConnectionPublic()
    if (!connection) {
      return NextResponse.json(
        { error: 'YouTube channel is not connected' },
        { status: 400 }
      )
    }

    const body = (await request.json()) as {
      title?: string
      description?: string
      privacyStatus?: 'private' | 'public' | 'unlisted'
    }
    if (!body.title?.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 })
    }

    const playlist = await createPlaylist({
      title: body.title,
      description: body.description,
      privacyStatus: body.privacyStatus || 'unlisted',
    })
    return NextResponse.json({ playlist }, { status: 201 })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to create playlist'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
