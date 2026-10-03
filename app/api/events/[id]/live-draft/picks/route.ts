import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import {
  adminDevModeRequiredResponse,
  isAdminDevModeRequest,
} from '@/app/lib/admin-dev-mode'
import {
  getLiveDraftCommissionerView,
  makeLiveDraftPick,
  skipLiveDraftPick,
  undoLiveDraftPick,
} from '@/app/lib/events/live-draft'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()
  if (!isAdminDevModeRequest(request)) return adminDevModeRequiredResponse()

  const { id: eventId } = await context.params
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const action = typeof body.action === 'string' ? body.action : 'pick'

  try {
    if (action === 'undo') {
      await undoLiveDraftPick(eventId)
    } else if (action === 'skip') {
      await skipLiveDraftPick(eventId, session.email)
    } else if (action === 'pick' || action === 'force') {
      const registrationId = typeof body.registrationId === 'string' ? body.registrationId : ''
      if (!registrationId) {
        return NextResponse.json({ error: 'registrationId is required' }, { status: 400 })
      }
      await makeLiveDraftPick(eventId, {
        registrationId,
        pickedBy: 'board',
        actor: session.email,
      })
    } else {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    const view = await getLiveDraftCommissionerView(eventId)
    return NextResponse.json(view)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Pick failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
