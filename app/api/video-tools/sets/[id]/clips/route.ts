import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { recordUploadedClip } from '@/app/lib/video-tools/mutations'
import { getVideoUploadSet } from '@/app/lib/video-tools/queries'
import { VIDEO_TOOLS_BLOB_PREFIX } from '@/app/lib/video-tools/naming'
import { getDb } from '@/app/lib/db'
import { videoUploadClips } from '@/app/db/schema'
import { eq } from 'drizzle-orm'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * Register a clip after a client Blob upload completes.
 * Needed on localhost (Blob onUploadCompleted webhook does not fire locally)
 * and as an idempotent fallback in production.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const { id: setId } = await context.params
    const body = (await request.json()) as {
      originalFilename?: string
      blobUrl?: string
      pathname?: string
      sizeBytes?: number
    }

    if (!body.originalFilename?.trim()) {
      return NextResponse.json({ error: 'originalFilename is required' }, { status: 400 })
    }
    if (!body.blobUrl?.trim()) {
      return NextResponse.json({ error: 'blobUrl is required' }, { status: 400 })
    }
    if (!body.pathname?.trim()) {
      return NextResponse.json({ error: 'pathname is required' }, { status: 400 })
    }

    const expectedPrefix = `${VIDEO_TOOLS_BLOB_PREFIX}${setId}/clips/`
    if (!body.pathname.startsWith(expectedPrefix)) {
      return NextResponse.json({ error: 'Invalid pathname for this set' }, { status: 400 })
    }

    const set = await getVideoUploadSet(setId)
    if (!set) {
      return NextResponse.json({ error: 'Upload set not found' }, { status: 404 })
    }

    const db = getDb()
    const [existing] = await db
      .select()
      .from(videoUploadClips)
      .where(eq(videoUploadClips.pathname, body.pathname))
      .limit(1)

    if (existing) {
      const refreshed = await getVideoUploadSet(setId)
      return NextResponse.json({ set: refreshed, clipId: existing.id })
    }

    const clip = await recordUploadedClip({
      setId,
      originalFilename: body.originalFilename,
      blobUrl: body.blobUrl,
      pathname: body.pathname,
      sizeBytes: body.sizeBytes ?? 0,
    })

    const refreshed = await getVideoUploadSet(setId)
    return NextResponse.json({ set: refreshed, clipId: clip.id }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to register clip'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
