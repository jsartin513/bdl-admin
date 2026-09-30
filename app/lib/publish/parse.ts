import {
  PUBLISH_KINDS,
  PUBLISH_MEDIA_TYPES,
  type PublishKind,
  type PublishMediaType,
} from '@/app/lib/publish/types'

function parseKind(value: unknown): PublishKind | null {
  if (typeof value !== 'string') return null
  return (PUBLISH_KINDS as readonly string[]).includes(value)
    ? (value as PublishKind)
    : null
}

function parseMediaType(value: unknown): PublishMediaType | null {
  if (value == null) return null
  if (typeof value !== 'string') return null
  return (PUBLISH_MEDIA_TYPES as readonly string[]).includes(value)
    ? (value as PublishMediaType)
    : null
}

function parseOptionalIsoDate(value: unknown): Date | null | undefined {
  if (value == null || value === '') return null
  if (typeof value !== 'string') return undefined
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return undefined
  return d
}

export function parsePublishPostWrite(body: unknown):
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; error: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Invalid body' }
  }
  const record = body as Record<string, unknown>
  const out: Record<string, unknown> = {}

  if (record.kind !== undefined) {
    const kind = parseKind(record.kind)
    if (!kind) return { ok: false, error: 'Invalid kind' }
    out.kind = kind
  }

  if (record.title !== undefined) {
    if (typeof record.title !== 'string' || !record.title.trim()) {
      return { ok: false, error: 'title is required' }
    }
    out.title = record.title.trim()
  }

  if (record.caption !== undefined) {
    if (typeof record.caption !== 'string') {
      return { ok: false, error: 'caption must be text' }
    }
    out.caption = record.caption
  }

  if (record.mediaUrl !== undefined) {
    if (record.mediaUrl != null && typeof record.mediaUrl !== 'string') {
      return { ok: false, error: 'mediaUrl must be text' }
    }
    out.mediaUrl = typeof record.mediaUrl === 'string' ? record.mediaUrl.trim() || null : null
  }

  if (record.mediaType !== undefined) {
    const mediaType = parseMediaType(record.mediaType)
    if (record.mediaType != null && !mediaType) {
      return { ok: false, error: 'mediaType must be image or video' }
    }
    out.mediaType = mediaType
  }

  for (const key of [
    'includeOpenGymFlyer',
    'includeSiteAlert',
    'includeNewsPost',
    'postedToInstagram',
    'postedToYoutube',
  ] as const) {
    if (record[key] !== undefined) {
      if (typeof record[key] !== 'boolean') {
        return { ok: false, error: `${key} must be boolean` }
      }
      out[key] = record[key]
    }
  }

  if (record.siteAlertKind !== undefined) {
    if (
      record.siteAlertKind !== null &&
      record.siteAlertKind !== 'news' &&
      record.siteAlertKind !== 'cancellation'
    ) {
      return { ok: false, error: 'siteAlertKind must be news or cancellation' }
    }
    out.siteAlertKind = record.siteAlertKind
  }

  if (record.siteAlertEndsAt !== undefined) {
    const parsed = parseOptionalIsoDate(record.siteAlertEndsAt)
    if (parsed === undefined) {
      return { ok: false, error: 'siteAlertEndsAt must be a valid date' }
    }
    out.siteAlertEndsAt = parsed
  }

  return { ok: true, value: out }
}

export function parsePublishCreate(body: unknown):
  | { ok: true; value: { kind: PublishKind; title: string } & Record<string, unknown> }
  | { ok: false; error: string } {
  const parsed = parsePublishPostWrite(body)
  if (!parsed.ok) return parsed
  const kind = parseKind((body as Record<string, unknown>).kind)
  const title =
    typeof (body as Record<string, unknown>).title === 'string'
      ? (body as Record<string, unknown>).title
      : null
  if (!kind) return { ok: false, error: 'kind is required' }
  if (!title || !String(title).trim()) return { ok: false, error: 'title is required' }
  return {
    ok: true,
    value: { kind, title: String(title).trim(), ...parsed.value },
  }
}
