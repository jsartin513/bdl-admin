import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { isDatabaseConfigured } from '@/app/lib/db'
import { parseRunAtFromBody, schedulePublishPost } from '@/app/lib/schedule/mutations'
import { getPublishPost, updatePublishPost } from '@/app/lib/publish/mutations'
import type { PublishPostWrite } from '@/app/lib/publish/mutations'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'DATABASE_URL is not configured' }, { status: 503 })
  }

  const { id } = await context.params
  try {
    const body = await request.json()
    const runAt = parseRunAtFromBody(body)

    const post = await getPublishPost(id)
    if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    if (post.status !== 'draft') {
      return NextResponse.json({ error: 'Only drafts can be scheduled' }, { status: 400 })
    }

    const patch: Partial<PublishPostWrite> = {}
    if (body.siteAlertStartsAt !== undefined) {
      patch.siteAlertStartsAt = body.siteAlertStartsAt
        ? new Date(String(body.siteAlertStartsAt))
        : null
    }
    if (body.siteAlertEndsAt !== undefined) {
      patch.siteAlertEndsAt = body.siteAlertEndsAt
        ? new Date(String(body.siteAlertEndsAt))
        : null
    }
    if (body.newsPublishAt !== undefined) {
      patch.newsPublishAt = body.newsPublishAt ? new Date(String(body.newsPublishAt)) : null
    }
    if (Object.keys(patch).length > 0) {
      await updatePublishPost(id, patch)
    }

    const result = await schedulePublishPost({
      publishPostId: id,
      actorEmail: session.email,
      runAt,
      sendSocialReminder: body.sendSocialReminder !== false,
    })

    const updated = await getPublishPost(id)
    return NextResponse.json({ ...result, post: updated })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Schedule failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
