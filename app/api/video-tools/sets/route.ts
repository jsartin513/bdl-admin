import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { createVideoUploadSet } from '@/app/lib/video-tools/mutations'
import { listVideoUploadSets } from '@/app/lib/video-tools/queries'

export async function GET(request: NextRequest) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const sets = await listVideoUploadSets()
    return NextResponse.json({ sets })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list upload sets'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const body = (await request.json()) as {
      eventName?: string
      label?: string
      eventDate?: string
    }

    if (!body.eventName?.trim()) {
      return NextResponse.json({ error: 'eventName is required' }, { status: 400 })
    }
    if (!body.label?.trim()) {
      return NextResponse.json({ error: 'label is required' }, { status: 400 })
    }
    if (!body.eventDate?.trim()) {
      return NextResponse.json({ error: 'eventDate is required' }, { status: 400 })
    }

    const set = await createVideoUploadSet({
      eventName: body.eventName,
      label: body.label,
      eventDate: body.eventDate,
      createdByEmail: session.email,
    })

    return NextResponse.json({ set }, { status: 201 })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create upload set'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
