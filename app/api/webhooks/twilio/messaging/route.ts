import { NextRequest, NextResponse } from 'next/server'
import {
  getMessagingPrefsForPhone,
  upsertMessagingOptOut,
} from '@/app/lib/contact/audience'
import { updateRecipientStatusByProviderId } from '@/app/lib/contact/jobs'
import {
  stripWhatsAppPrefix,
  validateTwilioSignature,
} from '@/app/lib/contact/providers/twilio'
import { normalizePhoneE164 } from '@/app/lib/contact/phone'

export const runtime = 'nodejs'

function formToParams(form: FormData): Record<string, string> {
  const params: Record<string, string> = {}
  form.forEach((value, key) => {
    if (typeof value === 'string') params[key] = value
  })
  return params
}

function webhookUrl(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()?.replace(/\/$/, '')
  if (configured) return `${configured}/api/webhooks/twilio/messaging`
  return request.url
}

/**
 * Twilio status callbacks + inbound SMS/WhatsApp (STOP / unsubscribe).
 */
export async function POST(request: NextRequest) {
  const form = await request.formData()
  const params = formToParams(form)
  const signature = request.headers.get('x-twilio-signature')

  const skipValidate = process.env.TWILIO_SKIP_SIGNATURE_VALIDATE === '1'
  if (!skipValidate) {
    const ok = validateTwilioSignature({
      signature,
      url: webhookUrl(request),
      params,
    })
    if (!ok) {
      return new NextResponse('Invalid signature', { status: 403 })
    }
  }

  const messageSid = params.MessageSid || params.SmsSid || ''
  const messageStatus = params.MessageStatus || params.SmsStatus || ''
  const body = (params.Body || '').trim()
  const fromRaw = params.From || ''
  const errorMessage = params.ErrorMessage || params.ErrorCode || null

  // Delivery status updates
  if (messageSid && messageStatus) {
    await updateRecipientStatusByProviderId({
      providerMessageId: messageSid,
      status: messageStatus,
      errorMessage,
    })
  }

  // Inbound STOP / opt-out
  const upper = body.toUpperCase()
  const isOptOut =
    upper === 'STOP' ||
    upper === 'STOPALL' ||
    upper === 'UNSUBSCRIBE' ||
    upper === 'CANCEL' ||
    upper === 'END' ||
    upper === 'QUIT'

  if (isOptOut && fromRaw) {
    const isWhatsApp = fromRaw.toLowerCase().startsWith('whatsapp:')
    const e164 = normalizePhoneE164(stripWhatsAppPrefix(fromRaw))
    if (e164) {
      const owner = await getMessagingPrefsForPhone(e164)
      if (owner) {
        await upsertMessagingOptOut({
          playerId: owner.playerId,
          channel: isWhatsApp ? 'whatsapp' : 'sms',
        })
      }
    }
  }

  // Twilio expects empty TwiML or 204 for status callbacks
  return new NextResponse(
    '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
    {
      status: 200,
      headers: { 'Content-Type': 'text/xml' },
    }
  )
}
