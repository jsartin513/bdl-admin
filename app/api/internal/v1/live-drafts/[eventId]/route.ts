import { NextRequest, NextResponse } from 'next/server'
import {
  isInternalAuthError,
  readInternalPlayerIdentity,
} from '@/app/lib/events/live-draft-internal-auth'
import {
  buildCaptainDraftSnapshot,
  getLiveDraftByEventId,
  resolveCaptainRegistration,
} from '@/app/lib/events/live-draft'

type RouteContext = { params: Promise<{ eventId: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
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

  try {
    const snapshot = await buildCaptainDraftSnapshot(eventId, identity.email)
    return NextResponse.json(snapshot)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to load draft'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
