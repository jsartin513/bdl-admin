import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import {
  deleteNonBdlEventPhoto,
  updateNonBdlEventPhoto,
} from '@/app/lib/non-bdl-events/mutations'

type RouteContext = { params: Promise<{ id: string; photoId: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const { id, photoId } = await context.params
    const body = (await request.json()) as {
      caption?: string | null
      sortOrder?: number
      teamIds?: string[]
      playerIds?: string[]
    }
    const photo = await updateNonBdlEventPhoto(id, photoId, body)
    return NextResponse.json({ photo })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to update photo'
    const status = message === 'Photo not found' ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const { id, photoId } = await context.params
    await deleteNonBdlEventPhoto(id, photoId)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to delete photo'
    const status = message === 'Photo not found' ? 404 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
