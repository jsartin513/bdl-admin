import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { createNonBdlEventTeam } from '@/app/lib/non-bdl-events/mutations'
import {
  getNonBdlEvent,
  listNonBdlEventTeams,
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
    const teams = await listNonBdlEventTeams(id)
    return NextResponse.json({ teams })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list teams'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const { id } = await context.params
    const body = (await request.json()) as {
      name?: string
      resultText?: string | null
    }
    if (!body.name?.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }
    const team = await createNonBdlEventTeam({
      eventId: id,
      name: body.name,
      resultText: body.resultText,
    })
    return NextResponse.json({ team }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create team'
    const status = message === 'Event not found' ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
