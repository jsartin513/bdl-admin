/**
 * Normalize a phone number to E.164.
 * Defaults bare 10-digit US/CA numbers to +1.
 * Returns null when the input cannot be normalized.
 */
export function normalizePhoneE164(raw: string | null | undefined): string | null {
  if (raw == null) return null
  const trimmed = raw.trim()
  if (!trimmed) return null

  const hasPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return null

  if (hasPlus) {
    if (digits.length < 8 || digits.length > 15) return null
    return `+${digits}`
  }

  // US/CA: 10 digits, or 11 starting with 1
  if (digits.length === 10) return `+1${digits}`
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`

  // Already includes country code without +
  if (digits.length >= 11 && digits.length <= 15) return `+${digits}`

  return null
}

/** Rough SMS segment count (GSM-7 160 / UCS-2 70). */
export function estimateSmsSegments(body: string): number {
  const hasUcs2 = /[^\x00-\x7F]/.test(body)
  const limit = hasUcs2 ? 70 : 160
  const multiLimit = hasUcs2 ? 67 : 153
  if (body.length === 0) return 0
  if (body.length <= limit) return 1
  return Math.ceil(body.length / multiLimit)
}
