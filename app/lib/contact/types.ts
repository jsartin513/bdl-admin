export type ContactChannel = 'email' | 'sms' | 'whatsapp'

export type ContactAudienceType = 'filter' | 'player_ids'

export type ContactJobStatus =
  | 'draft'
  | 'sending'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type ContactRecipientStatus =
  | 'pending'
  | 'skipped'
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'opted_out'

export type ContactSkipReason =
  | 'no_email'
  | 'no_phone'
  | 'opted_out'
  | 'merged'
  | 'no_opt_in'
  | 'invalid_address'

export type ContactAudienceFilters = {
  q?: string
  skill?: number | 'unset' | null
  homeLeague?: string | 'unset' | null
  eventId?: string | null
  includeMerged?: boolean
}

export type ContactAudienceInput =
  | { audienceType: 'player_ids'; playerIds: string[]; eventId?: string | null }
  | { audienceType: 'filter'; filters: ContactAudienceFilters }

export type ResolvedContactRecipient = {
  playerId: string
  firstName: string
  lastName: string
  rosterName: string
  address: string | null
  status: 'reachable' | 'skipped'
  skipReason: ContactSkipReason | null
}

export type ContactPreviewResult = {
  channel: ContactChannel
  total: number
  reachable: number
  skipped: number
  skippedByReason: Partial<Record<ContactSkipReason, number>>
  sample: ResolvedContactRecipient[]
  recipients: ResolvedContactRecipient[]
}

export type WhatsAppTemplateKey =
  | 'event_reminder'
  | 'schedule_change'
  | 'announcement'

export type WhatsAppTemplateDefinition = {
  key: WhatsAppTemplateKey
  label: string
  description: string
  /** Env var holding the Twilio Content SID */
  envVar: string
  variableKeys: string[]
}
