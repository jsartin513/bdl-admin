import { eq } from 'drizzle-orm'
import { outboundMessages } from '@/app/db/schema'
import { getDb } from '@/app/lib/db'
import type { RecordOutboundMessageInput } from '@/app/lib/outbound/types'
import { mapTwilioStatusToOutbound } from '@/app/lib/outbound/status'

export async function recordOutboundMessage(
  input: RecordOutboundMessageInput
): Promise<string | null> {
  try {
    const db = getDb()
    const [row] = await db
      .insert(outboundMessages)
      .values({
        channel: input.channel,
        kind: input.kind,
        status: input.status,
        toAddress: input.toAddress?.trim() || null,
        subject: input.subject?.trim() || null,
        provider: input.provider ?? null,
        providerMessageId: input.providerMessageId?.trim() || null,
        errorMessage: input.errorMessage?.trim() || null,
        skipReason: input.skipReason?.trim() || null,
        contactJobId: input.contactJobId ?? null,
        playerId: input.playerId ?? null,
        createdByAdminEmail: input.createdByAdminEmail?.trim() || null,
        sentAt: input.sentAt ?? null,
        updatedAt: new Date(),
      })
      .returning({ id: outboundMessages.id })
    return row?.id ?? null
  } catch (err) {
    const message = err instanceof Error ? err.message : 'record failed'
    console.error('[outbound] recordOutboundMessage failed', message)
    return null
  }
}

export async function updateOutboundMessageByProviderId(opts: {
  providerMessageId: string
  status: string
  errorMessage?: string | null
}): Promise<void> {
  const mapped = mapTwilioStatusToOutbound(opts.status)
  if (!mapped) return

  try {
    const db = getDb()
    const [existing] = await db
      .select()
      .from(outboundMessages)
      .where(eq(outboundMessages.providerMessageId, opts.providerMessageId))
      .limit(1)
    if (!existing) return

    await db
      .update(outboundMessages)
      .set({
        status: mapped,
        errorMessage: opts.errorMessage?.trim() || existing.errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(outboundMessages.id, existing.id))
  } catch (err) {
    const message = err instanceof Error ? err.message : 'update failed'
    console.error('[outbound] updateOutboundMessageByProviderId failed', message)
  }
}
