import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { getContactJob } from '@/app/lib/contact/jobs'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: Ctx) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  const { id } = await context.params
  try {
    const result = await getContactJob(id)
    if (!result) {
      return NextResponse.json({ error: 'Contact job not found' }, { status: 404 })
    }
    return NextResponse.json(result)
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to load contact job'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
