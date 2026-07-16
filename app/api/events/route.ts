import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { createEvent } from '@/app/lib/events/mutations'
import { listEvents } from '@/app/lib/events/queries'
import { isValidEventType } from '@/app/lib/events/types'

export async function GET(request: NextRequest) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const events = await listEvents()
    return NextResponse.json({ events })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list events'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const body = (await request.json()) as {
      name?: string
      eventDate?: string
      eventType?: string | null
      notes?: string | null
    }

    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    if (!body.eventDate?.trim()) {
      return NextResponse.json({ error: 'eventDate is required' }, { status: 400 })
    }
    if (
      body.eventType != null &&
      body.eventType !== '' &&
      !isValidEventType(body.eventType)
    ) {
      return NextResponse.json({ error: 'Invalid eventType' }, { status: 400 })
    }

    const event = await createEvent({
      name: body.name,
      eventDate: body.eventDate,
      eventType: body.eventType,
      notes: body.notes,
    })

    return NextResponse.json({ event }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create event'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
