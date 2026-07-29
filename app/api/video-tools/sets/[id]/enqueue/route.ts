import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { enqueueVideoUploadSet } from '@/app/lib/video-tools/mutations'
import { getVideoUploadSet } from '@/app/lib/video-tools/queries'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const { id } = await context.params
    await enqueueVideoUploadSet(id)
    const set = await getVideoUploadSet(id)
    return NextResponse.json({ set })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to enqueue upload set'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
