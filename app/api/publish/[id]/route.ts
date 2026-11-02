import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { isDatabaseConfigured } from '@/app/lib/db'
import { getPublishPost, updatePublishPost } from '@/app/lib/publish/mutations'
import { parsePublishPostWrite } from '@/app/lib/publish/parse'
import type { PublishPostWrite } from '@/app/lib/publish/mutations'

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'DATABASE_URL is not configured' }, { status: 503 })
  }
  const { id } = await context.params
  const post = await getPublishPost(id)
  if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ post })
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'DATABASE_URL is not configured' }, { status: 503 })
  }

  const { id } = await context.params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = parsePublishPostWrite(body)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  try {
    const post = await updatePublishPost(id, parsed.value as Partial<PublishPostWrite> & {
      postedToInstagram?: boolean
      postedToYoutube?: boolean
    })
    if (!post) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ post })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to update post'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
