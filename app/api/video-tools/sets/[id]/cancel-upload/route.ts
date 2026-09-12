import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { cancelPendingClipUpload } from '@/app/lib/video-tools/mutations'
import { getVideoUploadSet } from '@/app/lib/video-tools/queries'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * Decrement pending_upload_count after an abandoned/failed client upload.
 * Safe to call more than once (floors at 0).
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const { id: setId } = await context.params
    const set = await getVideoUploadSet(setId)
    if (!set) {
      return NextResponse.json({ error: 'Upload set not found' }, { status: 404 })
    }

    await cancelPendingClipUpload(setId)
    const refreshed = await getVideoUploadSet(setId)
    return NextResponse.json({ set: refreshed })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to cancel pending upload'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
