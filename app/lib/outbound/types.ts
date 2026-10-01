export type OutboundChannel = 'email' | 'sms' | 'whatsapp'

export type OutboundKind = 'contact' | 'video_notify' | 'login_alert'

export type OutboundStatus =
  | 'skipped'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'opted_out'

export type OutboundProvider = 'resend' | 'twilio'

export type RecordOutboundMessageInput = {
  channel: OutboundChannel
  kind: OutboundKind
  status: OutboundStatus
  toAddress?: string | null
  subject?: string | null
  provider?: OutboundProvider | null
  providerMessageId?: string | null
  errorMessage?: string | null
  skipReason?: string | null
  contactJobId?: string | null
  playerId?: string | null
  createdByAdminEmail?: string | null
  sentAt?: Date | null
}

export type OutboundMessageRecord = {
  id: string
  channel: OutboundChannel
  kind: OutboundKind
  status: OutboundStatus
  toAddress: string | null
  subject: string | null
  provider: OutboundProvider | null
  providerMessageId: string | null
  errorMessage: string | null
  skipReason: string | null
  contactJobId: string | null
  playerId: string | null
  createdByAdminEmail: string | null
  sentAt: string | null
  createdAt: string
  updatedAt: string
}

export type OutboundListFilters = {
  status?: OutboundStatus | 'sent_group' | null
  channel?: OutboundChannel | null
  kind?: OutboundKind | null
  q?: string | null
  limit?: number
}

export type OutboundSummary = {
  sent: number
  failed: number
  skipped: number
}
