import twilio from 'twilio'
import { normalizePhoneE164 } from '@/app/lib/contact/phone'

export type SendTwilioResult = {
  providerMessageId: string
  status: string
}

function getTwilioCreds() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  if (!accountSid || !authToken) {
    throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required')
  }
  return { accountSid, authToken }
}

export function isTwilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      (process.env.TWILIO_MESSAGING_SERVICE_SID?.trim() ||
        process.env.TWILIO_FROM_NUMBER?.trim())
  )
}

export function getTwilioClient() {
  const { accountSid, authToken } = getTwilioCreds()
  return twilio(accountSid, authToken)
}

function messagingFromFields(): {
  messagingServiceSid?: string
  from?: string
} {
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim()
  if (messagingServiceSid) return { messagingServiceSid }
  const from = process.env.TWILIO_FROM_NUMBER?.trim()
  if (from) return { from }
  throw new Error(
    'Set TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER for outbound SMS'
  )
}

function whatsappFromAddress(): string {
  const from =
    process.env.TWILIO_WHATSAPP_FROM?.trim() ||
    process.env.TWILIO_FROM_NUMBER?.trim()
  if (!from) {
    throw new Error('TWILIO_WHATSAPP_FROM (or TWILIO_FROM_NUMBER) is required')
  }
  return from.startsWith('whatsapp:') ? from : `whatsapp:${from}`
}

/** Send an SMS via Twilio Messages API. */
export async function sendTwilioSms(opts: {
  toE164: string
  body: string
  statusCallback?: string
}): Promise<SendTwilioResult> {
  const to = normalizePhoneE164(opts.toE164)
  if (!to) throw new Error('Invalid destination phone number')

  if (process.env.CONTACT_DRY_RUN === '1') {
    return { providerMessageId: `dry-run-sms-${Date.now()}`, status: 'sent' }
  }

  const client = getTwilioClient()
  const message = await client.messages.create({
    to,
    body: opts.body,
    ...messagingFromFields(),
    ...(opts.statusCallback ? { statusCallback: opts.statusCallback } : {}),
  })

  return {
    providerMessageId: message.sid,
    status: message.status,
  }
}

/**
 * Send a WhatsApp template (Content SID) via Twilio.
 * Business-initiated messages require an approved template.
 */
export async function sendTwilioWhatsAppTemplate(opts: {
  toE164: string
  contentSid: string
  contentVariables?: Record<string, string>
  statusCallback?: string
}): Promise<SendTwilioResult> {
  const toRaw = normalizePhoneE164(opts.toE164)
  if (!toRaw) throw new Error('Invalid destination phone number')
  const to = `whatsapp:${toRaw}`

  if (process.env.CONTACT_DRY_RUN === '1') {
    return {
      providerMessageId: `dry-run-wa-${Date.now()}`,
      status: 'sent',
    }
  }

  const client = getTwilioClient()
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim()

  const message = await client.messages.create({
    to,
    contentSid: opts.contentSid,
    ...(opts.contentVariables
      ? { contentVariables: JSON.stringify(opts.contentVariables) }
      : {}),
    ...(messagingServiceSid
      ? { messagingServiceSid }
      : { from: whatsappFromAddress() }),
    ...(opts.statusCallback ? { statusCallback: opts.statusCallback } : {}),
  })

  return {
    providerMessageId: message.sid,
    status: message.status,
  }
}

/** Validate Twilio request signature for webhooks. */
export function validateTwilioSignature(opts: {
  signature: string | null
  url: string
  params: Record<string, string>
}): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  if (!authToken) return false
  if (!opts.signature) return false
  return twilio.validateRequest(
    authToken,
    opts.signature,
    opts.url,
    opts.params
  )
}

export function stripWhatsAppPrefix(address: string): string {
  return address.replace(/^whatsapp:/i, '')
}
