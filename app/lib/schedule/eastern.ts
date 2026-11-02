const EASTERN = 'America/New_York'
const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
const HAS_TIMEZONE_SUFFIX = /(Z|[+-]\d{2}:\d{2}|[+-]\d{4})$/i

function pad(value: number) {
  return String(value).padStart(2, '0')
}

type ZonedParts = {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

function zonedParts(date: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value)
  let hour = read('hour')
  if (hour === 24) hour = 0
  return {
    year: read('year'),
    month: read('month'),
    day: read('day'),
    hour,
    minute: read('minute'),
    second: read('second'),
  }
}

export function formatEasternLocal(date: Date): string {
  const parts = zonedParts(date, EASTERN)
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`
}

/** Parse datetime-local value as America/New_York. */
export function easternLocalToDate(value: string): Date | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  if (HAS_TIMEZONE_SUFFIX.test(trimmed)) {
    const parsed = new Date(trimmed)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  const iso = trimmed.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)
  if (iso) {
    const match = LOCAL_RE.exec(trimmed.slice(0, 16))
    if (!match) return null
    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])
    const hour = Number(match[4])
    const minute = Number(match[5])
    if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
      return null
    }
    const guessUtc = Date.UTC(year, month - 1, day, hour, minute, 0)
    const offset = zoneOffsetMs(new Date(guessUtc), EASTERN)
    const asUtc = Date.UTC(year, month - 1, day, hour, minute, 0) - offset
    const roundTrip = formatEasternLocal(new Date(asUtc))
    if (roundTrip !== trimmed.slice(0, 16)) return null
    return new Date(asUtc)
  }
  const parsed = new Date(trimmed)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function zoneOffsetMs(date: Date, timeZone: string) {
  const parts = zonedParts(date, timeZone)
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second)
  return asUtc - date.getTime()
}

export function parseScheduledRunAt(value: unknown): Date {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('runAt is required')
  }
  const date = easternLocalToDate(value) ?? (value.includes('T') ? new Date(value) : null)
  if (!date || Number.isNaN(date.getTime())) {
    throw new Error('runAt must be a valid date/time')
  }
  const minLeadMs = 60_000
  if (date.getTime() < Date.now() + minLeadMs) {
    throw new Error('runAt must be at least one minute in the future')
  }
  return date
}

export function toIsoOrNull(value: string | null | undefined): string | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}
