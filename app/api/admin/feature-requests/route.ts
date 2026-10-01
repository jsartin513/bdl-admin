import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import { createFeatureRequestIssue } from '@/app/lib/feature-requests'

export async function POST(request: NextRequest) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  let body: {
    title?: string
    description?: string
    pagePath?: string | null
  }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const description =
    typeof body.description === 'string' ? body.description.trim() : ''
  const pagePath =
    typeof body.pagePath === 'string' ? body.pagePath.trim() : null

  if (!title || title.length < 3) {
    return NextResponse.json(
      { error: 'Title must be at least 3 characters' },
      { status: 400 }
    )
  }
  if (!description || description.length < 10) {
    return NextResponse.json(
      { error: 'Description must be at least 10 characters' },
      { status: 400 }
    )
  }
  if (title.length > 200) {
    return NextResponse.json(
      { error: 'Title must be at most 200 characters' },
      { status: 400 }
    )
  }
  if (description.length > 8000) {
    return NextResponse.json(
      { error: 'Description must be at most 8000 characters' },
      { status: 400 }
    )
  }

  try {
    const result = await createFeatureRequestIssue({
      title,
      description,
      submittedBy: session.email,
      pagePath,
      token: process.env.GITHUB_FEATURE_REQUEST_TOKEN?.trim() || null,
    })
    return NextResponse.json(result)
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to create feature request'
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
