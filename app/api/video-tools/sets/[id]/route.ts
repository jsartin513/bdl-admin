import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import {
  enqueueYoutubeUpload,
  markSetReady,
  maybeAutoEnqueueVideoUploadSet,
  resetPendingUploads,
  setAutoEnqueueOnReady,
  setYoutubePlaylist,
  updateVideoUploadSetMetadata,
} from '@/app/lib/video-tools/mutations'
import { getVideoUploadSet } from '@/app/lib/video-tools/queries'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const { id } = await context.params
    const set = await getVideoUploadSet(id)
    if (!set) {
      return NextResponse.json({ error: 'Upload set not found' }, { status: 404 })
    }
    return NextResponse.json({ set })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load upload set'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const { id } = await context.params
    const body = (await request.json()) as {
      action?: string
      eventName?: string
      label?: string
      eventDate?: string
      autoEnqueueOnReady?: boolean
      playlistId?: string | null
      playlistTitle?: string | null
    }

    if (body.action === 'mark_ready') {
      const updated = await markSetReady(id)
      const set = await getVideoUploadSet(updated.id)
      return NextResponse.json({ set })
    }

    if (body.action === 'reset_pending_uploads') {
      const updated = await resetPendingUploads(id)
      const set = await getVideoUploadSet(updated.id)
      return NextResponse.json({ set })
    }

    if (body.action === 'update_metadata') {
      if (
        typeof body.eventName !== 'string' ||
        typeof body.label !== 'string' ||
        typeof body.eventDate !== 'string'
      ) {
        return NextResponse.json(
          { error: 'eventName, label, and eventDate are required' },
          { status: 400 }
        )
      }
      const set = await updateVideoUploadSetMetadata(id, {
        eventName: body.eventName,
        label: body.label,
        eventDate: body.eventDate,
      })
      return NextResponse.json({ set })
    }

    if (body.action === 'set_auto_enqueue') {
      if (typeof body.autoEnqueueOnReady !== 'boolean') {
        return NextResponse.json(
          { error: 'autoEnqueueOnReady must be a boolean' },
          { status: 400 }
        )
      }
      await setAutoEnqueueOnReady(id, body.autoEnqueueOnReady)
      // If enabling after uploads already finished, try to enqueue now.
      if (body.autoEnqueueOnReady) {
        await maybeAutoEnqueueVideoUploadSet(id)
      }
      const set = await getVideoUploadSet(id)
      return NextResponse.json({ set })
    }

    if (body.action === 'maybe_auto_enqueue') {
      await maybeAutoEnqueueVideoUploadSet(id)
      const set = await getVideoUploadSet(id)
      return NextResponse.json({ set })
    }

    if (body.action === 'set_youtube_playlist') {
      const playlistId =
        body.playlistId === null || body.playlistId === undefined
          ? null
          : String(body.playlistId)
      const playlistTitle =
        body.playlistTitle === null || body.playlistTitle === undefined
          ? null
          : String(body.playlistTitle)
      const updated = await setYoutubePlaylist(id, {
        playlistId,
        playlistTitle,
      })
      const set = await getVideoUploadSet(updated.id)
      return NextResponse.json({ set })
    }

    if (body.action === 'enqueue_youtube_upload') {
      const updated = await enqueueYoutubeUpload(id)
      const set = await getVideoUploadSet(updated.id)
      return NextResponse.json({ set })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update upload set'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
