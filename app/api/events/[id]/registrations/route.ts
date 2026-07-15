import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { getEvent, listEventRegistrations } from '@/app/lib/events/queries'

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

    const registrations = await listEventRegistrations(id)
    return NextResponse.json({ registrations })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to list registrations'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
