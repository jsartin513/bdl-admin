import { NextRequest, NextResponse } from 'next/server'
import {
  isInternalAuthError,
  readInternalPlayerIdentity,
} from '@/app/lib/events/live-draft-internal-auth'
import {
  buildCaptainDraftSnapshot,
  getLiveDraftByEventId,
  makeLiveDraftPick,
  resolveCaptainRegistration,
} from '@/app/lib/events/live-draft'

type RouteContext = { params: Promise<{ eventId: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  const identity = readInternalPlayerIdentity(request)
  if (isInternalAuthError(identity)) return identity

  const { eventId } = await context.params
  const draft = await getLiveDraftByEventId(eventId)
  if (!draft) {
    return NextResponse.json({ error: 'Live draft not found' }, { status: 404 })
  }

  const captain = await resolveCaptainRegistration(eventId, identity.email)
  if (!captain) {
    return NextResponse.json({ error: 'Not a captain for this event' }, { status: 403 })
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const registrationId = typeof body.registrationId === 'string' ? body.registrationId : ''
  if (!registrationId) {
    return NextResponse.json({ error: 'registrationId is required' }, { status: 400 })
  }

  try {
    const slotGroup = draft.pickSequence[draft.currentPickIndex]
    await makeLiveDraftPick(eventId, {
      registrationId,
      pickedBy: 'captain',
      actor: identity.email,
      expectedDraftGroup: slotGroup,
    })
    const snapshot = await buildCaptainDraftSnapshot(eventId, identity.email)
    return NextResponse.json(snapshot)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Pick failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
