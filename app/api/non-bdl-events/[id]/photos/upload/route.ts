import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { uploadNonBdlEventPhoto } from '@/app/lib/non-bdl-events/mutations'

type RouteContext = { params: Promise<{ id: string }> }

function parseIdList(value: FormDataEntryValue | null): string[] {
  if (value == null) return []
  const raw = String(value).trim()
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) {
      return parsed.filter((v): v is string => typeof v === 'string')
    }
  } catch {
    // comma-separated fallback
  }
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export async function POST(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const { id } = await context.params
    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 })
    }
    const caption = formData.get('caption')?.toString() ?? null
    const teamIds = parseIdList(formData.get('teamIds'))
    const playerIds = parseIdList(formData.get('playerIds'))

    const photo = await uploadNonBdlEventPhoto({
      eventId: id,
      file,
      caption,
      teamIds,
      playerIds,
    })
    return NextResponse.json({ photo }, { status: 201 })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to upload photo'
    const status = message === 'Event not found' ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
