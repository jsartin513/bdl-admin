import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import {
  createEventDraftSnapshot,
  listEventDraftSnapshots,
} from '@/app/lib/events/mutations'
import { getEvent } from '@/app/lib/events/queries'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const { id } = await context.params
    const event = await getEvent(id)
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    const snapshots = await listEventDraftSnapshots(id)
    return NextResponse.json({ snapshots })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to list snapshots'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const { id } = await context.params
    const event = await getEvent(id)
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const body = (await request.json()) as {
      name?: unknown
      assignments?: unknown
    }
    if (typeof body.name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const snapshot = await createEventDraftSnapshot({
      eventId: id,
      name: body.name,
      assignments: body.assignments,
    })
    return NextResponse.json({ snapshot }, { status: 201 })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to create snapshot'
    const status =
      message.includes('required') || message.includes('assignments')
        ? 400
        : 500
    return NextResponse.json({ error: message }, { status })
  }
}
