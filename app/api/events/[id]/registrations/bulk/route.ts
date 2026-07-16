import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { bulkUpdateRegistrationDraftGroups } from '@/app/lib/events/mutations'
import { getEvent } from '@/app/lib/events/queries'
import { parseDraftGroup } from '@/app/lib/events/types'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const { id } = await context.params
    const event = await getEvent(id)
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }

    const body = (await request.json()) as {
      assignments?: Array<{ registrationId?: unknown; draftGroup?: unknown }>
    }

    if (!Array.isArray(body.assignments)) {
      return NextResponse.json(
        { error: 'assignments must be an array' },
        { status: 400 }
      )
    }

    // Validate early for clear API errors
    for (const item of body.assignments) {
      if (!item || typeof item.registrationId !== 'string' || !item.registrationId) {
        return NextResponse.json(
          { error: 'Each assignment needs a registrationId string' },
          { status: 400 }
        )
      }
      if (!('draftGroup' in item)) {
        return NextResponse.json(
          { error: 'Each assignment needs a draftGroup' },
          { status: 400 }
        )
      }
      const draftGroup = parseDraftGroup(item.draftGroup)
      if (draftGroup === undefined) {
        return NextResponse.json(
          { error: 'Each assignment needs a draftGroup' },
          { status: 400 }
        )
      }
    }

    const registrations = await bulkUpdateRegistrationDraftGroups(
      id,
      body.assignments.map((a) => ({
        registrationId: a.registrationId as string,
        draftGroup: a.draftGroup as number | null,
      }))
    )

    return NextResponse.json({ registrations })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to update registrations'
    const status =
      message.startsWith('Registration not found')
        ? 404
        : message.includes('draftGroup') || message.includes('registrationId')
          ? 400
          : 500
    return NextResponse.json({ error: message }, { status })
  }
}
