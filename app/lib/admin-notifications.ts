import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { getDb } from '@/app/lib/db'
import { adminNotifications } from '@/app/db/schema'
import type { AdminNotificationRecord } from '@/app/lib/video-tools/types'

function mapNotification(
  row: typeof adminNotifications.$inferSelect
): AdminNotificationRecord {
  return {
    id: row.id,
    recipientEmail: row.recipientEmail,
    title: row.title,
    body: row.body,
    href: row.href,
    readAt: row.readAt,
    createdAt: row.createdAt,
  }
}

export async function createAdminNotification(input: {
  recipientEmail: string
  title: string
  body: string
  href?: string | null
}): Promise<AdminNotificationRecord> {
  const recipientEmail = input.recipientEmail.trim().toLowerCase()
  if (!recipientEmail) throw new Error('recipientEmail is required')
  const title = input.title.trim()
  const body = input.body.trim()
  if (!title) throw new Error('title is required')
  if (!body) throw new Error('body is required')

  const db = getDb()
  const [created] = await db
    .insert(adminNotifications)
    .values({
      recipientEmail,
      title,
      body,
      href: input.href?.trim() || null,
    })
    .returning()

  return mapNotification(created)
}

export async function listAdminNotificationsForEmail(
  email: string,
  options?: { limit?: number; unreadOnly?: boolean }
): Promise<AdminNotificationRecord[]> {
  const recipientEmail = email.trim().toLowerCase()
  if (!recipientEmail) return []

  const limit = Math.min(Math.max(options?.limit ?? 20, 1), 50)
  const db = getDb()

  const conditions = [eq(adminNotifications.recipientEmail, recipientEmail)]
  if (options?.unreadOnly) {
    conditions.push(isNull(adminNotifications.readAt))
  }

  const rows = await db
    .select()
    .from(adminNotifications)
    .where(and(...conditions))
    .orderBy(desc(adminNotifications.createdAt))
    .limit(limit)

  return rows.map(mapNotification)
}

export async function countUnreadAdminNotifications(
  email: string
): Promise<number> {
  const recipientEmail = email.trim().toLowerCase()
  if (!recipientEmail) return 0

  const db = getDb()
  const [row] = await db
    .select({
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(adminNotifications)
    .where(
      and(
        eq(adminNotifications.recipientEmail, recipientEmail),
        isNull(adminNotifications.readAt)
      )
    )

  return Number(row?.count) || 0
}

export async function markAdminNotificationRead(
  id: string,
  email: string
): Promise<AdminNotificationRecord | null> {
  const recipientEmail = email.trim().toLowerCase()
  if (!recipientEmail) return null

  const db = getDb()
  const [updated] = await db
    .update(adminNotifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(adminNotifications.id, id),
        eq(adminNotifications.recipientEmail, recipientEmail)
      )
    )
    .returning()

  return updated ? mapNotification(updated) : null
}

export async function markAllAdminNotificationsRead(
  email: string
): Promise<number> {
  const recipientEmail = email.trim().toLowerCase()
  if (!recipientEmail) return 0

  const db = getDb()
  const updated = await db
    .update(adminNotifications)
    .set({ readAt: new Date() })
    .where(
      and(
        eq(adminNotifications.recipientEmail, recipientEmail),
        isNull(adminNotifications.readAt)
      )
    )
    .returning({ id: adminNotifications.id })

  return updated.length
}
