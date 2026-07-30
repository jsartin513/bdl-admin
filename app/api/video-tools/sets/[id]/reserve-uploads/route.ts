import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { reservePendingClipUploads } from '@/app/lib/video-tools/mutations'
import { getVideoUploadSet } from '@/app/lib/video-tools/queries'

type RouteContext = { params: Promise<{ id: string }> }

/**
 * Reserve N pending upload slots before a multi-file batch so pending count
 * does not hit zero between sequential files (auto-enqueue race).
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const { id } = await context.params
    const body = (await request.json()) as { count?: number }
    const count = typeof body.count === 'number' ? body.count : NaN

    const updated = await reservePendingClipUploads(id, count)
    const set = await getVideoUploadSet(updated.id)
    return NextResponse.json({ set })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to reserve upload slots'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
