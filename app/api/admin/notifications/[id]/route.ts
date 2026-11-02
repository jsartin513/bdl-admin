import { NextRequest, NextResponse } from 'next/server'
import {
  adminUnauthorizedResponse,
  getAdminSessionFromRequest,
} from '@/app/lib/admin-auth'
import {
  countUnreadAdminNotifications,
  markAdminNotificationRead,
} from '@/app/lib/admin-notifications'

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, context: RouteContext) {
  const session = getAdminSessionFromRequest(request)
  if (!session) return adminUnauthorizedResponse()

  try {
    const { id } = await context.params
    const body = (await request.json()) as { action?: string }
    if (body.action !== 'mark_read') {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }

    const notification = await markAdminNotificationRead(id, session.email)
    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 })
    }
    const unreadCount = await countUnreadAdminNotifications(session.email)
    return NextResponse.json({ notification, unreadCount })
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Failed to update notification'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
