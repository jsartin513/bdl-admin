import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { promoteEventDraftSnapshot } from '@/app/lib/events/mutations'
import { getEvent } from '@/app/lib/events/queries'

type RouteContext = {
  params: Promise<{ id: string; snapshotId: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const { id, snapshotId } = await context.params
    const event = await getEvent(id)
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const results = await promoteEventDraftSnapshot(id, snapshotId)
    return NextResponse.json({ ok: true, results })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to promote snapshot'
    const status =
      message === 'Snapshot not found' || message.includes('Registration not found')
        ? 404
        : message.includes('draftGroup') || message.includes('assignments')
          ? 400
          : 500
    return NextResponse.json({ error: message }, { status })
  }
}
