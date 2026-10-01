import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import {
  ensureLiveDraft,
  getLiveDraftCommissionerView,
  setLiveDraftStatus,
  startLiveDraft,
  updateLiveDraftSetup,
} from '@/app/lib/events/live-draft'
import type { LiveDraftOrderType } from '@/app/lib/events/live-draft-sequence'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  const { id: eventId } = await context.params
  try {
    const view = await getLiveDraftCommissionerView(eventId)
    return NextResponse.json(view)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load live draft'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  const { id: eventId } = await context.params
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  try {
    if (body.action === 'start') {
      const draft = await startLiveDraft(eventId)
      return NextResponse.json({ draft })
    }

    if (body.action === 'pause') {
      const draft = await setLiveDraftStatus(eventId, 'paused')
      return NextResponse.json({ draft })
    }

    if (body.action === 'resume') {
      const draft = await setLiveDraftStatus(eventId, 'live')
      return NextResponse.json({ draft })
    }

    if (body.action === 'complete') {
      const draft = await setLiveDraftStatus(eventId, 'complete')
      return NextResponse.json({ draft })
    }

    const orderType = body.orderType as LiveDraftOrderType | undefined
    const teamOrder = Array.isArray(body.teamOrder)
      ? body.teamOrder.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0)
      : undefined
    const customSlots =
      body.customSlots === null
        ? null
        : Array.isArray(body.customSlots)
          ? body.customSlots.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0)
          : undefined

    const rulesRaw =
      body.rules && typeof body.rules === 'object'
        ? (body.rules as Record<string, unknown>)
        : undefined

    const parsedRules = rulesRaw
      ? {
          ...(Number.isFinite(Number(rulesRaw.minWomenNb))
            ? { minWomenNb: Number(rulesRaw.minWomenNb) }
            : {}),
          ...(rulesRaw.includeOtherInWomenNb !== undefined
            ? { includeOtherInWomenNb: Boolean(rulesRaw.includeOtherInWomenNb) }
            : {}),
          ...(Number.isFinite(Number(rulesRaw.minIntermediate))
            ? { minIntermediate: Number(rulesRaw.minIntermediate) }
            : {}),
          ...(Number.isFinite(Number(rulesRaw.intermediateMin))
            ? { intermediateMin: Number(rulesRaw.intermediateMin) }
            : {}),
          ...(Number.isFinite(Number(rulesRaw.intermediateMax))
            ? { intermediateMax: Number(rulesRaw.intermediateMax) }
            : {}),
        }
      : undefined

    const draft = await updateLiveDraftSetup(eventId, {
      orderType,
      teamOrder,
      customSlots,
      rules: parsedRules,
    })

    return NextResponse.json({ draft })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update live draft'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  const { id: eventId } = await context.params
  try {
    const draft = await ensureLiveDraft(eventId)
    return NextResponse.json({ draft })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create live draft'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
