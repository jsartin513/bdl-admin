import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import {
  deleteNonBdlEventAttendee,
  updateNonBdlEventAttendee,
} from '@/app/lib/non-bdl-events/mutations'
import { listNonBdlEventAttendees } from '@/app/lib/non-bdl-events/queries'

type RouteContext = { params: Promise<{ id: string; attendeeId: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const { id, attendeeId } = await context.params
    const body = (await request.json()) as {
      teamId?: string | null
      notes?: string | null
    }
    await updateNonBdlEventAttendee(id, attendeeId, body)
    const attendees = await listNonBdlEventAttendees(id)
    const attendee = attendees.find((a) => a.id === attendeeId)
    return NextResponse.json({ attendee })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to update attendee'
    const status =
      message === 'Attendee not found' ||
      message === 'Team not found for this event'
        ? 404
        : 400
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const { id, attendeeId } = await context.params
    await deleteNonBdlEventAttendee(id, attendeeId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to delete attendee'
    const status = message === 'Attendee not found' ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
