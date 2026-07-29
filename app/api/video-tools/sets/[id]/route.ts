import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { markSetReady } from '@/app/lib/video-tools/mutations'
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
    const body = (await request.json()) as { action?: string }

    if (body.action === 'mark_ready') {
      const updated = await markSetReady(id)
      const set = await getVideoUploadSet(updated.id)
      return NextResponse.json({ set })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update upload set'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
