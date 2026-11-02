import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { parseEventUpdatePatch } from '@/app/lib/events/event-update-patch'
import { deleteEvent, updateEvent } from '@/app/lib/events/mutations'
import { getEvent } from '@/app/lib/events/queries'
import {
  ballTypeLabel,
  eventFormatLabel,
  eventGenderLabel,
  eventTypeLabel,
} from '@/app/lib/events/types'

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
    return NextResponse.json({
      event: {
        ...event,
        eventTypeLabel: eventTypeLabel(event.eventType),
        eventFormatLabel: eventFormatLabel(event.eventFormat),
        ballTypeLabel: ballTypeLabel(event.ballType),
        genderLabel: eventGenderLabel(event.gender),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load event'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const { id } = await context.params
    const body = await request.json()
    const patch = parseEventUpdatePatch(body)

    const event = await updateEvent(id, patch)
    return NextResponse.json({
      event: {
        ...event,
        eventTypeLabel: eventTypeLabel(event.eventType),
        eventFormatLabel: eventFormatLabel(event.eventFormat),
        ballTypeLabel: ballTypeLabel(event.ballType),
        genderLabel: eventGenderLabel(event.gender),
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update event'
    const status = message === 'Event not found' ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const { id } = await context.params
    await deleteEvent(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete event'
    const status = message === 'Event not found' ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
