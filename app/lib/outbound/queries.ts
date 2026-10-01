import {
  and,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  or,
  sql,
} from 'drizzle-orm'
import { outboundMessages } from '@/app/db/schema'
import { getDb } from '@/app/lib/db'
import type {
  OutboundListFilters,
  OutboundMessageRecord,
  OutboundSummary,
} from '@/app/lib/outbound/types'

const SENT_STATUSES = ['sent', 'delivered'] as const

function mapRow(row: typeof outboundMessages.$inferSelect): OutboundMessageRecord {
  return {
    id: row.id,
    channel: row.channel as OutboundMessageRecord['channel'],
    kind: row.kind as OutboundMessageRecord['kind'],
    status: row.status as OutboundMessageRecord['status'],
    toAddress: row.toAddress,
    subject: row.subject,
    provider: (row.provider as OutboundMessageRecord['provider']) ?? null,
    providerMessageId: row.providerMessageId,
    errorMessage: row.errorMessage,
    skipReason: row.skipReason,
    contactJobId: row.contactJobId,
    playerId: row.playerId,
    createdByAdminEmail: row.createdByAdminEmail,
    sentAt: row.sentAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function parseOutboxLimit(raw: string | null | undefined): number {
  if (!raw?.trim()) return 50
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 1) return 50
  return Math.min(100, Math.floor(parsed))
}

export async function listOutboundMessages(
  filters: OutboundListFilters
): Promise<OutboundMessageRecord[]> {
  const db = getDb()
  const limit = filters.limit ?? 50
  const conditions: ReturnType<typeof eq>[] = []

  if (filters.channel) {
    conditions.push(eq(outboundMessages.channel, filters.channel))
  }
  if (filters.kind) {
    conditions.push(eq(outboundMessages.kind, filters.kind))
  }
  if (filters.status === 'sent_group') {
    conditions.push(inArray(outboundMessages.status, [...SENT_STATUSES]))
  } else if (filters.status) {
    conditions.push(eq(outboundMessages.status, filters.status))
  }

  const q = filters.q?.trim()
  if (q) {
    const pattern = `%${q.replace(/%/g, '\\%')}%`
    conditions.push(
      or(
        ilike(outboundMessages.toAddress, pattern),
        ilike(outboundMessages.subject, pattern)
      )!
    )
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  const rows = await db
    .select()
    .from(outboundMessages)
    .where(where)
    .orderBy(desc(outboundMessages.createdAt))
    .limit(limit)

  return rows.map(mapRow)
}

export async function getOutboundSummaryLast7Days(): Promise<OutboundSummary> {
  const db = getDb()
  const since = new Date()
  since.setDate(since.getDate() - 7)

  const [row] = await db
    .select({
      sent: sql<number>`cast(count(*) filter (where ${outboundMessages.status} in ('sent', 'delivered')) as int)`,
      failed: sql<number>`cast(count(*) filter (where ${outboundMessages.status} = 'failed') as int)`,
      skipped: sql<number>`cast(count(*) filter (where ${outboundMessages.status} = 'skipped') as int)`,
    })
    .from(outboundMessages)
    .where(gte(outboundMessages.createdAt, since))

  return {
    sent: Number(row?.sent) || 0,
    failed: Number(row?.failed) || 0,
    skipped: Number(row?.skipped) || 0,
  }
}
