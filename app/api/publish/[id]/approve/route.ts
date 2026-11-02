import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { isDatabaseConfigured } from '@/app/lib/db'
import { approvePublishPost } from '@/app/lib/publish/mutations'
import { buildSocialKit } from '@/app/lib/publish/social-kit'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'DATABASE_URL is not configured' }, { status: 503 })
  }

  const { id } = await context.params
  try {
    const post = await approvePublishPost(id, session.email)
    const socialKit = buildSocialKit(post)
    return NextResponse.json({ post, socialKit })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Approve failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
