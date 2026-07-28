import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import {
  deleteNonBdlEvent,
  updateNonBdlEvent,
} from '@/app/lib/non-bdl-events/mutations'
import { getNonBdlEventDetail } from '@/app/lib/non-bdl-events/queries'
import {
  ballTypeLabel,
  hostOrgDisplayLabel,
  isValidBallType,
} from '@/app/lib/non-bdl-events/types'
import { buildGoodLuckFromDetail } from '@/app/lib/non-bdl-events/good-luck'
import { isValidHomeLeague } from '@/app/lib/players/home-league'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const { id } = await context.params
    const detail = await getNonBdlEventDetail(id)
    if (!detail) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 })
    }
    return NextResponse.json({
      ...detail,
      goodLuckBlurb: buildGoodLuckFromDetail(detail),
    })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to load non-BDL event'
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
      ballType?: string | null
      division?: string | null
      city?: string | null
      hostOrgHomeLeague?: string | null
      hostOrgName?: string | null
      notes?: string | null
    }

    if (
      body.ballType != null &&
      body.ballType !== '' &&
      !isValidBallType(body.ballType)
    ) {
      return NextResponse.json({ error: 'Invalid ballType' }, { status: 400 })
    }
    if (
      body.hostOrgHomeLeague != null &&
      body.hostOrgHomeLeague !== '' &&
      !isValidHomeLeague(body.hostOrgHomeLeague)
    ) {
      return NextResponse.json(
        { error: 'Invalid hostOrgHomeLeague' },
        { status: 400 }
      )
    }

    const event = await updateNonBdlEvent(id, body)
    return NextResponse.json({
      event: {
        ...event,
        ballTypeLabel: ballTypeLabel(event.ballType),
        hostOrgLabel: hostOrgDisplayLabel(
          event.hostOrgHomeLeague,
          event.hostOrgName
        ),
      },
    })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to update non-BDL event'
    const status = message === 'Event not found' ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const { id } = await context.params
    await deleteNonBdlEvent(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to delete non-BDL event'
    const status = message === 'Event not found' ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
