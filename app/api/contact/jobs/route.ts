import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { parseContactJobRequest } from '@/app/lib/contact/parse'
import { createAndSendContactJob } from '@/app/lib/contact/jobs'

export async function POST(request: NextRequest) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const body = await request.json()
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
