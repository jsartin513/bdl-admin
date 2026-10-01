import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { parseContactJobRequest } from '@/app/lib/contact/parse'
import { createAndSendContactJob } from '@/app/lib/contact/jobs'
import { parseRunAtFromBody, scheduleContactJob } from '@/app/lib/schedule/mutations'

export async function POST(request: NextRequest) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const body = await request.json()
    if (body && typeof body === 'object' && body.runAt) {
      const runAt = parseRunAtFromBody(body)
      const action = await scheduleContactJob({
        body,
        actorEmail: session.email,
        runAt,
        idempotencyKey:
          typeof body.idempotencyKey === 'string' ? body.idempotencyKey : null,
      })
      return NextResponse.json({ scheduled: true, action })
    }

    const parsed = parseContactJobRequest(body)
    const result = await createAndSendContactJob({
      request: parsed,
      actorEmail: session.email,
    })
    return NextResponse.json(result)
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to create contact job'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
