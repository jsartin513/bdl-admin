import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import {
  deleteEventDraftSnapshot,
  getEventDraftSnapshot,
  renameEventDraftSnapshot,
} from '@/app/lib/events/mutations'
import { getEvent } from '@/app/lib/events/queries'

type RouteContext = {
  params: Promise<{ id: string; snapshotId: string }>
}

export async function GET(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const { id, snapshotId } = await context.params
    const event = await getEvent(id)
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    const snapshot = await getEventDraftSnapshot(id, snapshotId)
    if (!snapshot) {
      return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 })
    }
    return NextResponse.json({ snapshot })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to load snapshot'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const { id, snapshotId } = await context.params
    const event = await getEvent(id)
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const body = (await request.json()) as { name?: unknown }
    if (typeof body.name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const snapshot = await renameEventDraftSnapshot(id, snapshotId, body.name)
    return NextResponse.json({ snapshot })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to rename snapshot'
    const status =
      message === 'Snapshot not found'
        ? 404
        : message.includes('required')
          ? 400
          : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const { id, snapshotId } = await context.params
    const event = await getEvent(id)
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    await deleteEventDraftSnapshot(id, snapshotId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to delete snapshot'
    const status = message === 'Snapshot not found' ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
