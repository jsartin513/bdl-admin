import type { contactJobs } from '@/app/db/schema'
import { recordOutboundMessage } from '@/app/lib/outbound/log'
import {
  mapContactRecipientToOutbound,
  providerForContactChannel,
} from '@/app/lib/outbound/status'
import type { ContactChannel } from '@/app/lib/contact/types'

type JobRow = typeof contactJobs.$inferSelect

type RecipientRow = {
  playerId: string
  address: string | null
  status: string
  skipReason: string | null
  providerMessageId: string | null
  errorMessage: string | null
  sentAt: Date | null
}

function subjectPreview(job: JobRow): string {
  const subject = job.subject?.trim()
  if (subject) return subject.slice(0, 200)
  const body = job.bodyText?.trim()
  if (body) return body.slice(0, 120)
  if (job.channel === 'whatsapp') return 'WhatsApp template'
  return ''
}

export async function logContactRecipientsToOutbound(
  job: JobRow,
  recipients: RecipientRow[]
): Promise<void> {
  const channel = job.channel as ContactChannel
  const provider = providerForContactChannel(channel)
  const subject = subjectPreview(job)

  for (const recipient of recipients) {
    const outboundStatus = mapContactRecipientToOutbound(recipient.status)
    const skipReason =
      outboundStatus === 'skipped'
        ? recipient.skipReason || (recipient.status === 'pending' ? 'pending' : null)
        : null

    await recordOutboundMessage({
      channel,
      kind: 'contact',
      status: outboundStatus,
      toAddress: recipient.address,
      subject,
      provider: outboundStatus === 'skipped' ? null : provider,
      providerMessageId: recipient.providerMessageId,
      errorMessage: recipient.errorMessage,
      skipReason,
      contactJobId: job.id,
      playerId: recipient.playerId,
      createdByAdminEmail: job.createdByAdminEmail,
      sentAt: recipient.sentAt,
    })
  }
}
