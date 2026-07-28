import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import {
  deleteNonBdlEventStory,
  updateNonBdlEventStory,
} from '@/app/lib/non-bdl-events/mutations'

type RouteContext = { params: Promise<{ id: string; storyId: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const { id, storyId } = await context.params
    const body = (await request.json()) as {
      title?: string | null
      body?: string
      sortOrder?: number
      teamIds?: string[]
      playerIds?: string[]
    }
    const story = await updateNonBdlEventStory(id, storyId, body)
    return NextResponse.json({ story })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to update story'
    const status = message === 'Story not found' ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const { id, storyId } = await context.params
    await deleteNonBdlEventStory(id, storyId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to delete story'
    const status = message === 'Story not found' ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
