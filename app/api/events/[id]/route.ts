import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { deleteEvent, updateEvent } from '@/app/lib/events/mutations'
import { getEvent } from '@/app/lib/events/queries'
import {
  ballTypeLabel,
  eventGenderLabel,
  eventTypeLabel,
  isValidBallType,
  isValidEventGender,
  isValidEventType,
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
    const body = (await request.json()) as {
      name?: string
      eventDate?: string
      eventType?: string | null
      ballType?: string | null
      gender?: string | null
      notes?: string | null
      pairingEnabled?: boolean
      teamNames?: string[]
      teamsLocked?: boolean
      finalizeTeams?: boolean
    }

    if (
      body.eventType != null &&
      body.eventType !== '' &&
      !isValidEventType(body.eventType)
    ) {
      return NextResponse.json({ error: 'Invalid eventType' }, { status: 400 })
    }
    if (
      body.ballType != null &&
      body.ballType !== '' &&
      !isValidBallType(body.ballType)
    ) {
      return NextResponse.json({ error: 'Invalid ballType' }, { status: 400 })
    }
    if (
      body.gender != null &&
      body.gender !== '' &&
      !isValidEventGender(body.gender)
    ) {
      return NextResponse.json({ error: 'Invalid gender' }, { status: 400 })
    }

    if (
      body.pairingEnabled !== undefined &&
      typeof body.pairingEnabled !== 'boolean'
    ) {
      return NextResponse.json(
        { error: 'pairingEnabled must be a boolean' },
        { status: 400 }
      )
    }

    if (body.teamNames !== undefined && !Array.isArray(body.teamNames)) {
      return NextResponse.json(
        { error: 'teamNames must be an array of strings' },
        { status: 400 }
      )
    }

    if (
      body.teamsLocked !== undefined &&
      typeof body.teamsLocked !== 'boolean'
    ) {
      return NextResponse.json(
        { error: 'teamsLocked must be a boolean' },
        { status: 400 }
      )
    }

    if (
      body.finalizeTeams !== undefined &&
      typeof body.finalizeTeams !== 'boolean'
    ) {
      return NextResponse.json(
        { error: 'finalizeTeams must be a boolean' },
        { status: 400 }
      )
    }

    const event = await updateEvent(id, body)
    return NextResponse.json({
      event: {
        ...event,
        eventTypeLabel: eventTypeLabel(event.eventType),
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
