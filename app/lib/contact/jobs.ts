import { eq } from 'drizzle-orm'
import { getDb } from '@/app/lib/db'
import { contactJobRecipients, contactJobs, players } from '@/app/db/schema'
import { previewContactAudience } from '@/app/lib/contact/audience'
import {
  plainTextToHtml,
  renderContactTemplate,
} from '@/app/lib/contact/templates'
import {
  isEmailProviderConfigured,
  sendContactEmail,
} from '@/app/lib/contact/providers/email'
import {
  isTwilioConfigured,
  sendTwilioSms,
  sendTwilioWhatsAppTemplate,
} from '@/app/lib/contact/providers/twilio'
import {
  resolveWhatsAppTemplateSid,
} from '@/app/lib/contact/whatsapp-templates'
import type { ParsedContactJobRequest } from '@/app/lib/contact/parse'
import type { ContactChannel } from '@/app/lib/contact/types'

/** Inline send runs in the request cycle; keep campaigns small to avoid timeouts. */
export const DEFAULT_CONTACT_MAX_RECIPIENTS = 50

export function contactMaxRecipients(): number {
  const raw = process.env.CONTACT_MAX_RECIPIENTS?.trim()
  if (!raw) return DEFAULT_CONTACT_MAX_RECIPIENTS
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 1) return DEFAULT_CONTACT_MAX_RECIPIENTS
  return Math.floor(parsed)
}

function statusCallbackUrl(): string | undefined {
  const base = process.env.NEXT_PUBLIC_APP_URL?.trim()?.replace(/\/$/, '')
  if (!base) return undefined
  const withScheme = /^https?:\/\//i.test(base) ? base : `https://${base}`
  return `${withScheme.replace(/\/$/, '')}/api/webhooks/twilio/messaging`
}

function assertChannelConfigured(channel: ContactChannel) {
  if (channel === 'email' && !isEmailProviderConfigured()) {
    if (process.env.CONTACT_DRY_RUN === '1') return
    throw new Error('Email provider is not configured (RESEND_API_KEY)')
  }
  if ((channel === 'sms' || channel === 'whatsapp') && !isTwilioConfigured()) {
    if (process.env.CONTACT_DRY_RUN === '1') return
    throw new Error('Twilio is not configured')
  }
}

export async function createAndSendContactJob(opts: {
  request: ParsedContactJobRequest
  actorEmail: string
}) {
  const { request, actorEmail } = opts
  assertChannelConfigured(request.channel)

  const db = getDb()

  if (request.idempotencyKey) {
    const [existing] = await db
      .select()
      .from(contactJobs)
      .where(eq(contactJobs.idempotencyKey, request.idempotencyKey))
      .limit(1)
    if (existing) {
      return getContactJob(existing.id)
    }
  }

  const preview = await previewContactAudience({
    channel: request.channel,
    audience: request.audience,
  })

  const maxRecipients = contactMaxRecipients()
  if (preview.reachable > maxRecipients) {
    throw new Error(
      `Audience has ${preview.reachable} reachable recipients; max per send is ${maxRecipients}. Narrow the audience or raise CONTACT_MAX_RECIPIENTS.`
    )
  }

  let templateSid: string | null = null
  if (request.channel === 'whatsapp' && request.whatsappTemplateKey) {
    templateSid = resolveWhatsAppTemplateSid(request.whatsappTemplateKey)
    if (!templateSid && process.env.CONTACT_DRY_RUN !== '1') {
      throw new Error(
        `WhatsApp template "${request.whatsappTemplateKey}" is not configured`
      )
    }
    templateSid = templateSid || `dry-run-${request.whatsappTemplateKey}`
  }

  const bodyText = request.bodyText?.trim() || null
  const bodyHtml =
    request.bodyHtml?.trim() ||
    (bodyText ? plainTextToHtml(bodyText) : null)

  const [job] = await db
    .insert(contactJobs)
    .values({
      createdByAdminEmail: actorEmail,
      channel: request.channel,
      audienceType: request.audience.audienceType,
      audienceSnapshot: preview.audienceSnapshot,
      eventId: preview.eventId,
      subject: request.subject?.trim() || null,
      bodyText,
      bodyHtml,
      templateSid,
      templateVariables: request.templateVariables ?? null,
      status: 'sending',
      idempotencyKey: request.idempotencyKey || null,
    })
    .returning()

  if (preview.recipients.length > 0) {
    await db.insert(contactJobRecipients).values(
      preview.recipients.map((r) => ({
        jobId: job.id,
        playerId: r.playerId,
        address: r.address,
        status: r.status === 'reachable' ? 'pending' : 'skipped',
        skipReason: r.skipReason,
      }))
    )
  }

  await processContactJob(job.id, {
    eventName: preview.eventName,
    eventDate: preview.eventDate,
    whatsappTemplateKey: request.whatsappTemplateKey ?? null,
  })

  return getContactJob(job.id)
}

async function processContactJob(
  jobId: string,
  ctx: {
    eventName: string | null
    eventDate: string | null
    whatsappTemplateKey: string | null
  }
) {
  const db = getDb()
  const [job] = await db
    .select()
    .from(contactJobs)
    .where(eq(contactJobs.id, jobId))
    .limit(1)
  if (!job) return

  const recipients = await db
    .select()
    .from(contactJobRecipients)
    .where(eq(contactJobRecipients.jobId, jobId))

  const pending = recipients.filter((r) => r.status === 'pending')
  let hardFail: string | null = null

  for (const recipient of pending) {
    if (!recipient.address) {
      await db
        .update(contactJobRecipients)
        .set({
          status: 'skipped',
          skipReason: 'invalid_address',
          updatedAt: new Date(),
        })
        .where(eq(contactJobRecipients.id, recipient.id))
      continue
    }

    try {
      await db
        .update(contactJobRecipients)
        .set({ status: 'queued', updatedAt: new Date() })
        .where(eq(contactJobRecipients.id, recipient.id))

      const [player] = await db
        .select({
          firstName: players.firstName,
        })
        .from(players)
        .where(eq(players.id, recipient.playerId))
        .limit(1)

      const vars = {
        firstName: player?.firstName ?? 'there',
        eventName: ctx.eventName,
        eventDate: ctx.eventDate,
      }

      let providerMessageId: string

      if (job.channel === 'email') {
        const subject = renderContactTemplate(job.subject || '', vars)
        const text = renderContactTemplate(job.bodyText || '', vars)
        const html = renderContactTemplate(
          job.bodyHtml || plainTextToHtml(job.bodyText || ''),
          vars
        )
        const result = await sendContactEmail({
          to: recipient.address,
          subject,
          text,
          html,
        })
        providerMessageId = result.providerMessageId
      } else if (job.channel === 'sms') {
        const text = renderContactTemplate(job.bodyText || '', vars)
        const result = await sendTwilioSms({
          toE164: recipient.address,
          body: text,
          statusCallback: statusCallbackUrl(),
        })
        providerMessageId = result.providerMessageId
      } else {
        const contentVars: Record<string, string> = {
          ...(job.templateVariables ?? {}),
          firstName: vars.firstName,
        }
        if (vars.eventName) contentVars.eventName = vars.eventName
        if (vars.eventDate) contentVars.eventDate = vars.eventDate
        // Twilio Content Variables are typically numbered "1","2",...
        // If the admin provided numbered keys, keep them; else map known names.
        const numbered: Record<string, string> = {}
        if (Object.keys(contentVars).some((k) => /^\d+$/.test(k))) {
          for (const [k, v] of Object.entries(contentVars)) {
            if (/^\d+$/.test(k)) numbered[k] = v
          }
        } else {
          // Default mapping for our template keys
          numbered['1'] = contentVars.firstName || 'there'
          if (contentVars.eventName) numbered['2'] = contentVars.eventName
          if (contentVars.eventDate) numbered['3'] = contentVars.eventDate
          if (contentVars.body) {
            numbered['2'] = contentVars.body
          }
        }

        const result = await sendTwilioWhatsAppTemplate({
          toE164: recipient.address,
          contentSid: job.templateSid || '',
          contentVariables: numbered,
          statusCallback: statusCallbackUrl(),
        })
        providerMessageId = result.providerMessageId
      }

      await db
        .update(contactJobRecipients)
        .set({
          status: 'sent',
          providerMessageId,
          sentAt: new Date(),
          updatedAt: new Date(),
          errorMessage: null,
        })
        .where(eq(contactJobRecipients.id, recipient.id))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Send failed'
      hardFail = message
      await db
        .update(contactJobRecipients)
        .set({
          status: 'failed',
          errorMessage: message,
          updatedAt: new Date(),
        })
        .where(eq(contactJobRecipients.id, recipient.id))
    }
  }

  const finalRecipients = await db
    .select()
    .from(contactJobRecipients)
    .where(eq(contactJobRecipients.jobId, jobId))

  const anySent = finalRecipients.some(
    (r) => r.status === 'sent' || r.status === 'delivered' || r.status === 'queued'
  )
  const anyFailed = finalRecipients.some((r) => r.status === 'failed')
  const allSkipped =
    finalRecipients.length > 0 &&
    finalRecipients.every((r) => r.status === 'skipped')

  let status: string = 'completed'
  if (finalRecipients.length === 0) {
    status = 'completed'
  } else if (!anySent && anyFailed) {
    status = 'failed'
  } else if (allSkipped) {
    status = 'completed'
  } else if (anyFailed && hardFail && !anySent) {
    status = 'failed'
  }

  await db
    .update(contactJobs)
    .set({
      status,
      errorMessage: status === 'failed' ? hardFail : null,
      completedAt: new Date(),
    })
    .where(eq(contactJobs.id, jobId))
}

export async function getContactJob(jobId: string) {
  const db = getDb()
  const [job] = await db
    .select()
    .from(contactJobs)
    .where(eq(contactJobs.id, jobId))
    .limit(1)
  if (!job) return null

  const recipients = await db
    .select()
    .from(contactJobRecipients)
    .where(eq(contactJobRecipients.jobId, jobId))

  const counts = {
    total: recipients.length,
    pending: 0,
    skipped: 0,
    queued: 0,
    sent: 0,
    delivered: 0,
    failed: 0,
    opted_out: 0,
  }
  for (const r of recipients) {
    const key = r.status as keyof typeof counts
    if (key in counts && key !== 'total') {
      counts[key] += 1
    }
  }

  return { job, recipients, counts }
}

export async function updateRecipientStatusByProviderId(opts: {
  providerMessageId: string
  status: string
  errorMessage?: string | null
}) {
  const db = getDb()
  const mapped =
    opts.status === 'delivered'
      ? 'delivered'
      : opts.status === 'failed' ||
          opts.status === 'undelivered'
        ? 'failed'
        : opts.status === 'sent' || opts.status === 'queued'
          ? opts.status === 'queued'
            ? 'queued'
            : 'sent'
          : null

  if (!mapped) return null

  const [existing] = await db
    .select()
    .from(contactJobRecipients)
    .where(eq(contactJobRecipients.providerMessageId, opts.providerMessageId))
    .limit(1)
  if (!existing) return null

  await db
    .update(contactJobRecipients)
    .set({
      status: mapped,
      errorMessage: opts.errorMessage ?? existing.errorMessage,
      updatedAt: new Date(),
    })
    .where(eq(contactJobRecipients.id, existing.id))

  return existing
}
