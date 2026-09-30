import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { isDatabaseConfigured } from '@/app/lib/db'
import { createPublishPost, listPublishPosts } from '@/app/lib/publish/mutations'
import { parsePublishCreate } from '@/app/lib/publish/parse'
import type { PublishPostWrite } from '@/app/lib/publish/mutations'

export async function GET(request: NextRequest) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ posts: [] })
  }
  try {
    const posts = await listPublishPosts()
    return NextResponse.json({ posts })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list posts'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'DATABASE_URL is not configured' }, { status: 503 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = parsePublishCreate(body)
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const { kind, title, ...rest } = parsed.value
  try {
    const post = await createPublishPost({
      kind,
      title,
      ...(rest as Partial<PublishPostWrite>),
    })
    return NextResponse.json({ post })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create post'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
