import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { isDatabaseConfigured } from '@/app/lib/db'
import {
  isScheduledActionType,
  listScheduledActions,
  parseRunAtFromBody,
  scheduleContactJob,
  schedulePublishPost,
} from '@/app/lib/schedule/mutations'

export async function GET(request: NextRequest) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'DATABASE_URL is not configured' }, { status: 503 })
  }

  const status = request.nextUrl.searchParams.get('status') ?? undefined
  const actions = await listScheduledActions({ status: status ?? undefined, limit: 100 })
  return NextResponse.json({ actions })
}

export async function POST(request: NextRequest) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'DATABASE_URL is not configured' }, { status: 503 })
  }

  try {
    const body = await request.json()
    const runAt = parseRunAtFromBody(body)
    if (typeof body.actionType === 'string' && !isScheduledActionType(body.actionType)) {
      return NextResponse.json({ error: 'Invalid actionType' }, { status: 400 })
    }
    const actionType =
      typeof body.actionType === 'string' ? body.actionType : 'contact_job'

    if (actionType === 'publish_post') {
      const publishPostId =
        typeof body.publishPostId === 'string' ? body.publishPostId.trim() : ''
      if (!publishPostId) {
        return NextResponse.json({ error: 'publishPostId is required' }, { status: 400 })
      }
      const result = await schedulePublishPost({
        publishPostId,
        actorEmail: session.email,
        runAt,
        sendSocialReminder: body.sendSocialReminder !== false,
      })
      return NextResponse.json(result)
    }

    const action = await scheduleContactJob({
      body,
      actorEmail: session.email,
      runAt,
      idempotencyKey:
        typeof body.idempotencyKey === 'string' ? body.idempotencyKey : null,
    })
    return NextResponse.json({ action })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to schedule'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
