import { and, desc, eq, lte } from 'drizzle-orm'
import { publishPosts, scheduledActions } from '@/app/db/schema'
import { getDb } from '@/app/lib/db'
import { parseContactJobRequest } from '@/app/lib/contact/parse'
import type { ParsedContactJobRequest } from '@/app/lib/contact/parse'
import { createAndSendContactJob } from '@/app/lib/contact/jobs'
import { approvePublishPost } from '@/app/lib/publish/mutations'
import { parseScheduledRunAt } from '@/app/lib/schedule/eastern'
import { sendSocialKitReminderEmail } from '@/app/lib/schedule/social-reminder'
import type {
  ContactJobScheduledPayload,
  PublishPostScheduledPayload,
  ScheduledActionRecord,
  ScheduledActionType,
  SocialReminderScheduledPayload,
} from '@/app/lib/schedule/types'

function mapRow(row: typeof scheduledActions.$inferSelect): ScheduledActionRecord {
  return {
    id: row.id,
    createdByAdminEmail: row.createdByAdminEmail,
    runAt: row.runAt.toISOString(),
    timezone: row.timezone,
    actionType: row.actionType as ScheduledActionRecord['actionType'],
    payload: row.payload ?? {},
    status: row.status as ScheduledActionRecord['status'],
    idempotencyKey: row.idempotencyKey,
    errorMessage: row.errorMessage,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export async function listScheduledActions(opts?: {
  status?: string
  limit?: number
}): Promise<ScheduledActionRecord[]> {
  const db = getDb()
  const limit = opts?.limit ?? 50
  const conditions = opts?.status
    ? eq(scheduledActions.status, opts.status)
    : undefined
  const rows = await db
    .select()
    .from(scheduledActions)
    .where(conditions)
    .orderBy(desc(scheduledActions.runAt))
    .limit(limit)
  return rows.map(mapRow)
}

export async function getScheduledAction(id: string): Promise<ScheduledActionRecord | null> {
  const db = getDb()
  const [row] = await db.select().from(scheduledActions).where(eq(scheduledActions.id, id)).limit(1)
  return row ? mapRow(row) : null
}

export async function scheduleContactJob(opts: {
  body: unknown
  actorEmail: string
  runAt: Date
  idempotencyKey?: string | null
}): Promise<ScheduledActionRecord> {
  const parsed = parseContactJobRequest(opts.body)
  const db = getDb()

  if (opts.idempotencyKey) {
    const [existing] = await db
      .select()
      .from(scheduledActions)
      .where(eq(scheduledActions.idempotencyKey, opts.idempotencyKey))
      .limit(1)
    if (existing) return mapRow(existing)
  }

  const payload: ContactJobScheduledPayload = {
    contactRequest: parsed as unknown as Record<string, unknown>,
  }

  const [row] = await db
    .insert(scheduledActions)
    .values({
      createdByAdminEmail: opts.actorEmail,
      runAt: opts.runAt,
      actionType: 'contact_job',
      payload,
      status: 'scheduled',
      idempotencyKey: opts.idempotencyKey ?? null,
      updatedAt: new Date(),
    })
    .returning()

  return mapRow(row)
}

export async function schedulePublishPost(opts: {
  publishPostId: string
  actorEmail: string
  runAt: Date
  sendSocialReminder?: boolean
}): Promise<{ action: ScheduledActionRecord; postId: string }> {
  const db = getDb()
  const [post] = await db
    .select()
    .from(publishPosts)
    .where(eq(publishPosts.id, opts.publishPostId))
    .limit(1)
  if (!post) throw new Error('Post not found')
  if (post.status !== 'draft') {
    throw new Error('Only draft posts can be scheduled')
  }

  const payload: PublishPostScheduledPayload = {
    publishPostId: opts.publishPostId,
    sendSocialReminder: opts.sendSocialReminder ?? true,
  }

  const [action] = await db
    .insert(scheduledActions)
    .values({
      createdByAdminEmail: opts.actorEmail,
      runAt: opts.runAt,
      actionType: 'publish_post',
      payload,
      status: 'scheduled',
      updatedAt: new Date(),
    })
    .returning()

  await db
    .update(publishPosts)
    .set({
      status: 'scheduled',
      scheduledActionId: action.id,
      updatedAt: new Date(),
    })
    .where(eq(publishPosts.id, opts.publishPostId))

  return { action: mapRow(action), postId: opts.publishPostId }
}

export async function cancelScheduledAction(
  id: string,
  actorEmail: string
): Promise<ScheduledActionRecord> {
  const db = getDb()
  const [row] = await db.select().from(scheduledActions).where(eq(scheduledActions.id, id)).limit(1)
  if (!row) throw new Error('Scheduled action not found')
  if (row.status !== 'scheduled') {
    throw new Error('Only scheduled actions can be cancelled')
  }

  const [updated] = await db
    .update(scheduledActions)
    .set({
      status: 'cancelled',
      updatedAt: new Date(),
      completedAt: new Date(),
    })
    .where(eq(scheduledActions.id, id))
    .returning()

  if (row.actionType === 'publish_post') {
    const payload = row.payload as PublishPostScheduledPayload
    if (payload.publishPostId) {
      await db
        .update(publishPosts)
        .set({
          status: 'draft',
          scheduledActionId: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(publishPosts.id, payload.publishPostId),
            eq(publishPosts.scheduledActionId, id)
          )
        )
    }
  }

  void actorEmail
  return mapRow(updated)
}

async function markAction(
  id: string,
  patch: Partial<{
    status: string
    errorMessage: string | null
    completedAt: Date | null
  }>
) {
  const db = getDb()
  await db
    .update(scheduledActions)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(scheduledActions.id, id))
}

async function runContactJobPayload(
  payload: ContactJobScheduledPayload,
  actorEmail: string
) {
  const request = payload.contactRequest as unknown as ParsedContactJobRequest
  await createAndSendContactJob({ request, actorEmail })
}

async function runPublishPostPayload(
  payload: PublishPostScheduledPayload,
  actorEmail: string
) {
  const post = await approvePublishPost(payload.publishPostId, actorEmail)
  if (payload.sendSocialReminder) {
    await sendSocialKitReminderEmail({
      toEmail: actorEmail,
      publishPostId: post.id,
      title: post.title,
    })
  }
}

async function runSocialReminderPayload(payload: SocialReminderScheduledPayload) {
  await sendSocialKitReminderEmail({
    publishPostId: payload.publishPostId,
  })
}

export async function executeScheduledAction(action: ScheduledActionRecord): Promise<void> {
  if (action.actionType === 'contact_job') {
    await runContactJobPayload(action.payload as ContactJobScheduledPayload, action.createdByAdminEmail)
    return
  }
  if (action.actionType === 'publish_post') {
    await runPublishPostPayload(action.payload as PublishPostScheduledPayload, action.createdByAdminEmail)
    return
  }
  if (action.actionType === 'social_reminder') {
    await runSocialReminderPayload(action.payload as SocialReminderScheduledPayload)
    return
  }
  throw new Error(`Unknown action type: ${action.actionType}`)
}

/** Claim and run due scheduled actions (best-effort per row). */
export async function dispatchDueScheduledActions(opts?: {
  limit?: number
}): Promise<{ processed: number; errors: string[] }> {
  const db = getDb()
  const limit = opts?.limit ?? 10
  const now = new Date()

  const due = await db
    .select()
    .from(scheduledActions)
    .where(and(eq(scheduledActions.status, 'scheduled'), lte(scheduledActions.runAt, now)))
    .orderBy(scheduledActions.runAt)
    .limit(limit)

  const errors: string[] = []
  let processed = 0

  for (const row of due) {
    const claimed = await db
      .update(scheduledActions)
      .set({ status: 'running', updatedAt: new Date() })
      .where(and(eq(scheduledActions.id, row.id), eq(scheduledActions.status, 'scheduled')))
      .returning()

    if (!claimed[0]) continue

    const action = mapRow(claimed[0])
    try {
      await executeScheduledAction(action)
      await markAction(action.id, { status: 'completed', errorMessage: null, completedAt: new Date() })
      processed += 1
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Dispatch failed'
      errors.push(`${action.id}: ${message}`)
      await markAction(action.id, {
        status: 'failed',
        errorMessage: message,
        completedAt: new Date(),
      })
      if (action.actionType === 'publish_post') {
        const payload = action.payload as PublishPostScheduledPayload
        await db
          .update(publishPosts)
          .set({ status: 'draft', scheduledActionId: null, publishError: message, updatedAt: new Date() })
          .where(eq(publishPosts.id, payload.publishPostId))
      }
    }
  }

  return { processed, errors }
}

export function parseRunAtFromBody(body: unknown): Date {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Invalid body')
  }
  const record = body as Record<string, unknown>
  return parseScheduledRunAt(record.runAt)
}

export function isScheduledActionType(value: string): value is ScheduledActionType {
  return value === 'contact_job' || value === 'publish_post' || value === 'social_reminder'
}
