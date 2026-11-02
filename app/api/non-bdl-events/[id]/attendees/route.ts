import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { addNonBdlEventAttendee } from '@/app/lib/non-bdl-events/mutations'
import {
  getNonBdlEvent,
  listNonBdlEventAttendees,
} from '@/app/lib/non-bdl-events/queries'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const { id } = await context.params
    const event = await getNonBdlEvent(id)
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    const attendees = await listNonBdlEventAttendees(id)
    return NextResponse.json({ attendees })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to list attendees'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const { id } = await context.params
    const body = (await request.json()) as {
      playerId?: string
      teamId?: string | null
      notes?: string | null
    }
    if (!body.playerId) {
      return NextResponse.json(
        { error: 'playerId is required' },
        { status: 400 }
      )
    }
    const result = await addNonBdlEventAttendee({
      eventId: id,
      playerId: body.playerId,
      teamId: body.teamId,
      notes: body.notes,
    })
    const attendees = await listNonBdlEventAttendees(id)
    const attendee = attendees.find((a) => a.id === result.id)
    return NextResponse.json(
      { attendee, created: result.created },
      { status: result.created ? 201 : 200 }
    )
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to add attendee'
    const status =
      message === 'Event not found' || message === 'Player not found'
        ? 404
        : 400
    return NextResponse.json({ error: message }, { status })
  }
}
