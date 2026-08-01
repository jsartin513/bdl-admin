import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import {
  deleteEventRegistration,
  pairRegistrations,
  unpairRegistration,
  updateRegistrationCaptain,
  updateRegistrationDraftGroup,
} from '@/app/lib/events/mutations'
import { getEvent } from '@/app/lib/events/queries'
import { parseDraftGroup } from '@/app/lib/events/types'

type RouteContext = {
  params: Promise<{ id: string; registrationId: string }>
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const { id, registrationId } = await context.params
    const event = await getEvent(id)
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const body = (await request.json()) as {
      draftGroup?: unknown
      isCaptain?: unknown
      pairWithRegistrationId?: unknown
      unpair?: unknown
    }

    if (body.unpair === true) {
      if (!event.pairingEnabled) {
        return NextResponse.json(
          { error: 'Pairing is disabled for this event' },
          { status: 400 }
        )
      }
      const result = await unpairRegistration(id, registrationId)
      return NextResponse.json({ result })
    }

    if ('pairWithRegistrationId' in body) {
      if (!event.pairingEnabled) {
        return NextResponse.json(
          { error: 'Pairing is disabled for this event' },
          { status: 400 }
        )
      }
      if (
        typeof body.pairWithRegistrationId !== 'string' ||
        !body.pairWithRegistrationId
      ) {
        return NextResponse.json(
          { error: 'pairWithRegistrationId must be a registration id' },
          { status: 400 }
        )
      }
      const result = await pairRegistrations(
        id,
        registrationId,
        body.pairWithRegistrationId
      )
      return NextResponse.json({ result })
    }

    if ('isCaptain' in body) {
      if (typeof body.isCaptain !== 'boolean') {
        return NextResponse.json({ error: 'isCaptain must be a boolean' }, { status: 400 })
      }
      const registration = await updateRegistrationCaptain(id, registrationId, body.isCaptain)
      return NextResponse.json({ registration })
    }

    if (!('draftGroup' in body)) {
      return NextResponse.json({ error: 'draftGroup is required' }, { status: 400 })
    }

    // Validate early for clear API errors
    parseDraftGroup(body.draftGroup)

    const registration = await updateRegistrationDraftGroup(
      id,
      registrationId,
      body.draftGroup
    )
    return NextResponse.json({ registration })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to update registration'
    const status =
      message === 'Registration not found'
        ? 404
        : message.includes('draftGroup') ||
            message.includes('pair') ||
            message.includes('Pairing') ||
            message.includes('Cannot pair') ||
            message.includes('already paired') ||
            message.includes('captain')
          ? 400
          : 500
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const { id, registrationId } = await context.params
    const event = await getEvent(id)
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    await deleteEventRegistration(id, registrationId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to remove registration'
    const status = message === 'Registration not found' ? 404 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
