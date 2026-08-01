import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import {
  countUnreadAdminNotifications,
  listAdminNotificationsForEmail,
  markAllAdminNotificationsRead,
} from '@/app/lib/admin-notifications'

export async function GET(request: NextRequest) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const unreadOnly = request.nextUrl.searchParams.get('unread') === '1'
    const limitParam = request.nextUrl.searchParams.get('limit')
    const limit = limitParam ? Number(limitParam) : 20

    const [notifications, unreadCount] = await Promise.all([
      listAdminNotificationsForEmail(session.email, {
        limit: Number.isFinite(limit) ? limit : 20,
        unreadOnly,
      }),
      countUnreadAdminNotifications(session.email),
    ])

    return NextResponse.json({ notifications, unreadCount })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to load notifications'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const body = (await request.json()) as { action?: string }
    if (body.action === 'mark_all_read') {
      const updated = await markAllAdminNotificationsRead(session.email)
      const unreadCount = await countUnreadAdminNotifications(session.email)
      return NextResponse.json({ updated, unreadCount })
    }
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to update notifications'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
