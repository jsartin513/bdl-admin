import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { createNonBdlEventStory } from '@/app/lib/non-bdl-events/mutations'
import { getNonBdlEvent } from '@/app/lib/non-bdl-events/queries'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const { id } = await context.params
    const event = await getNonBdlEvent(id)
    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    const body = (await request.json()) as {
      title?: string | null
      body?: string
      sortOrder?: number
      teamIds?: string[]
      playerIds?: string[]
    }
    if (!body.body?.trim()) {
      return NextResponse.json({ error: 'body is required' }, { status: 400 })
    }
    const story = await createNonBdlEventStory({
      eventId: id,
      title: body.title,
      body: body.body,
      sortOrder: body.sortOrder,
      teamIds: body.teamIds,
      playerIds: body.playerIds,
    })
    return NextResponse.json({ story }, { status: 201 })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to create story'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
