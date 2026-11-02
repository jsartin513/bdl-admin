import { isValidHomeLeague } from '@/app/lib/players/home-league'
import type {
  ContactAudienceFilters,
  ContactAudienceInput,
  ContactChannel,
  WhatsAppTemplateKey,
} from '@/app/lib/contact/types'
import { getWhatsAppTemplate } from '@/app/lib/contact/whatsapp-templates'

export type ParsedContactPreviewRequest = {
  channel: ContactChannel
  audience: ContactAudienceInput
}

export type ParsedContactJobRequest = ParsedContactPreviewRequest & {
  subject?: string | null
  bodyText?: string | null
  bodyHtml?: string | null
  whatsappTemplateKey?: WhatsAppTemplateKey | null
  templateVariables?: Record<string, string> | null
  idempotencyKey?: string | null
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseChannel(value: unknown): ContactChannel {
  if (value === 'email' || value === 'sms' || value === 'whatsapp') return value
  throw new Error('channel must be email, sms, or whatsapp')
}

function parseSkill(value: unknown): number | 'unset' | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (value === 'unset') return 'unset'
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (typeof value === 'string' && /^\d+$/.test(value)) return Number.parseInt(value, 10)
  throw new Error('Invalid skill filter')
}

function parseHomeLeague(value: unknown): string | 'unset' | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (value === 'unset') return 'unset'
  if (typeof value === 'string' && isValidHomeLeague(value)) return value
  throw new Error('Invalid homeLeague filter')
}

function parseFilters(raw: unknown): ContactAudienceFilters {
  if (!isPlainObject(raw)) throw new Error('filters must be an object')
  const filters: ContactAudienceFilters = {}
  if ('q' in raw && raw.q != null) {
    if (typeof raw.q !== 'string') throw new Error('q must be a string')
    if (raw.q.trim()) filters.q = raw.q
  }
  if ('skill' in raw && raw.skill !== undefined) {
    filters.skill = parseSkill(raw.skill)
  }
  if ('homeLeague' in raw && raw.homeLeague !== undefined) {
    filters.homeLeague = parseHomeLeague(raw.homeLeague)
  }
  if ('eventId' in raw && raw.eventId !== undefined) {
    if (raw.eventId != null && typeof raw.eventId !== 'string') {
      throw new Error('eventId must be a string')
    }
    filters.eventId = typeof raw.eventId === 'string' ? raw.eventId : null
  }
  if ('includeMerged' in raw) {
    filters.includeMerged = Boolean(raw.includeMerged)
  }
  return filters
}

function parseAudience(body: Record<string, unknown>): ContactAudienceInput {
  if (Array.isArray(body.playerIds)) {
    if (body.playerIds.length === 0) {
      throw new Error('playerIds must be a non-empty array')
    }
    const playerIds: string[] = []
    const seen = new Set<string>()
    for (const id of body.playerIds) {
      if (typeof id !== 'string' || !id.trim()) {
        throw new Error('Each playerId must be a non-empty string')
      }
      if (seen.has(id)) continue
      seen.add(id)
      playerIds.push(id)
    }
    const eventId =
      typeof body.eventId === 'string' && body.eventId.trim()
        ? body.eventId.trim()
        : null
    return { audienceType: 'player_ids', playerIds, eventId }
  }

  if (body.filters != null || body.eventId != null || body.homeLeague != null) {
    if (body.filters != null) {
      return { audienceType: 'filter', filters: parseFilters(body.filters) }
    }
    const topLevel: Record<string, unknown> = {}
    if (body.q != null) topLevel.q = body.q
    if (body.skill !== undefined) topLevel.skill = body.skill
    if (body.homeLeague != null) topLevel.homeLeague = body.homeLeague
    if (body.eventId != null) topLevel.eventId = body.eventId
    if (body.includeMerged !== undefined) topLevel.includeMerged = body.includeMerged
    return { audienceType: 'filter', filters: parseFilters(topLevel) }
  }

  throw new Error('Provide playerIds or filters (e.g. eventId / homeLeague)')
}

export function parseContactPreviewRequest(body: unknown): ParsedContactPreviewRequest {
  if (!isPlainObject(body)) throw new Error('Request body must be an object')
  return {
    channel: parseChannel(body.channel),
    audience: parseAudience(body),
  }
}

export function parseContactJobRequest(body: unknown): ParsedContactJobRequest {
  const base = parseContactPreviewRequest(body)
  if (!isPlainObject(body)) throw new Error('Request body must be an object')

  const subject =
    body.subject === undefined
      ? undefined
      : body.subject === null
        ? null
        : typeof body.subject === 'string'
          ? body.subject
          : (() => {
              throw new Error('subject must be a string')
            })()

  const bodyText =
    body.bodyText === undefined
      ? undefined
      : body.bodyText === null
        ? null
        : typeof body.bodyText === 'string'
          ? body.bodyText
          : (() => {
              throw new Error('bodyText must be a string')
            })()

  const bodyHtml =
    body.bodyHtml === undefined
      ? undefined
      : body.bodyHtml === null
        ? null
        : typeof body.bodyHtml === 'string'
          ? body.bodyHtml
          : (() => {
              throw new Error('bodyHtml must be a string')
            })()

  let whatsappTemplateKey: WhatsAppTemplateKey | null | undefined
  if (body.whatsappTemplateKey !== undefined) {
    if (body.whatsappTemplateKey === null) {
      whatsappTemplateKey = null
    } else if (
      typeof body.whatsappTemplateKey === 'string' &&
      getWhatsAppTemplate(body.whatsappTemplateKey as WhatsAppTemplateKey)
    ) {
      whatsappTemplateKey = body.whatsappTemplateKey as WhatsAppTemplateKey
    } else {
      throw new Error('Invalid whatsappTemplateKey')
    }
  }

  let templateVariables: Record<string, string> | null | undefined
  if (body.templateVariables !== undefined) {
    if (body.templateVariables === null) {
      templateVariables = null
    } else if (isPlainObject(body.templateVariables)) {
      const vars: Record<string, string> = {}
      for (const [k, v] of Object.entries(body.templateVariables)) {
        if (typeof v !== 'string') {
          throw new Error('templateVariables values must be strings')
        }
        vars[k] = v
      }
      templateVariables = vars
    } else {
      throw new Error('templateVariables must be an object')
    }
  }

  const idempotencyKey =
    body.idempotencyKey === undefined
      ? undefined
      : body.idempotencyKey === null
        ? null
        : typeof body.idempotencyKey === 'string'
          ? body.idempotencyKey.trim() || null
          : (() => {
              throw new Error('idempotencyKey must be a string')
            })()

  if (base.channel === 'email') {
    if (!subject?.trim()) throw new Error('Email subject is required')
    if (!bodyText?.trim()) throw new Error('Email bodyText is required')
  }
  if (base.channel === 'sms') {
    if (!bodyText?.trim()) throw new Error('SMS bodyText is required')
    if ((bodyText?.length ?? 0) > 1600) {
      throw new Error('SMS bodyText must be 1600 characters or fewer')
    }
  }
  if (base.channel === 'whatsapp') {
    if (!whatsappTemplateKey) {
      throw new Error('whatsappTemplateKey is required for WhatsApp')
    }
  }

  return {
    ...base,
    subject,
    bodyText,
    bodyHtml,
    whatsappTemplateKey,
    templateVariables,
    idempotencyKey,
  }
}
