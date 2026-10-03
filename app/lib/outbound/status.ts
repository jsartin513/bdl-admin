import type { OutboundStatus } from '@/app/lib/outbound/types'

/** Map Twilio MessageStatus / SmsStatus to outbound log status. */
export function mapTwilioStatusToOutbound(
  twilioStatus: string
): OutboundStatus | null {
  const normalized = twilioStatus.trim().toLowerCase()
  if (normalized === 'delivered') return 'delivered'
  if (normalized === 'failed' || normalized === 'undelivered') return 'failed'
  if (normalized === 'sent') return 'sent'
  if (normalized === 'queued') return 'sent'
  return null
}

/** Map contact recipient status to outbound log status. */
export function mapContactRecipientToOutbound(
  recipientStatus: string
): OutboundStatus {
  switch (recipientStatus) {
    case 'delivered':
      return 'delivered'
    case 'sent':
    case 'queued':
      return 'sent'
    case 'failed':
      return 'failed'
    case 'opted_out':
      return 'opted_out'
    case 'skipped':
    case 'pending':
    default:
      return 'skipped'
  }
}

export function providerForContactChannel(
  channel: 'email' | 'sms' | 'whatsapp'
): 'resend' | 'twilio' {
  return channel === 'email' ? 'resend' : 'twilio'
}
