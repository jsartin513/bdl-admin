import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { updateRegistrationDraftGroup } from '@/app/lib/events/mutations'
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

    const body = (await request.json()) as { draftGroup?: unknown }
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
        : message.includes('draftGroup')
          ? 400
          : 500
    return NextResponse.json({ error: message }, { status })
  }
}
