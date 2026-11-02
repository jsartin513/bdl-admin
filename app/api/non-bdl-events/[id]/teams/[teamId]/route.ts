import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import {
  deleteNonBdlEventTeam,
  updateNonBdlEventTeam,
} from '@/app/lib/non-bdl-events/mutations'

type RouteContext = { params: Promise<{ id: string; teamId: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const { id, teamId } = await context.params
    const body = (await request.json()) as {
      name?: string
      resultText?: string | null
    }
    const team = await updateNonBdlEventTeam(id, teamId, body)
    return NextResponse.json({ team })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update team'
    const status =
      message === 'Team not found' || message === 'Team not found for this event'
        ? 404
        : 400
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const { id, teamId } = await context.params
    await deleteNonBdlEventTeam(id, teamId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete team'
    const status =
      message === 'Team not found' || message === 'Team not found for this event'
        ? 404
        : 400
    return NextResponse.json({ error: message }, { status })
  }
}
