import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import {
  clearPlayerPhoto,
  uploadPlayerPhoto,
} from '@/app/lib/players/mutations'

type RouteContext = { params: Promise<{ id: string }> }

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

    const player = await uploadPlayerPhoto(id, file, {
      actor: session.email,
      source: 'admin',
    })
    return NextResponse.json({ player })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to upload player photo'
    const status = message === 'Player not found' ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const { id } = await context.params
    const player = await clearPlayerPhoto(id, {
      actor: session.email,
      source: 'admin',
    })
    return NextResponse.json({ player })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to clear player photo'
    const status = message === 'Player not found' ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
