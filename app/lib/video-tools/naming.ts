/** ASCII slug for filenames: spaces → underscores, strip unsafe chars. */
export function slugifyForFilename(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .slice(0, 80)
}

/**
 * Merged, not-yet-trimmed deliverable name:
 * `{EventSlug}_{YYYY-MM-DD}_{LabelSlug}_untrimmed.MP4`
 */
export function buildUntrimmedOutputFilename(input: {
  eventName: string
  eventDate: string
  label: string
}): string {
  const eventSlug = slugifyForFilename(input.eventName) || 'Event'
  const labelSlug = slugifyForFilename(input.label) || 'Court'
  return `${eventSlug}_${input.eventDate}_${labelSlug}_untrimmed.MP4`
}

export function displayTitle(eventName: string, label: string): string {
  return `${eventName} · ${label}`
}

export const VIDEO_TOOLS_BLOB_PREFIX = 'video-tools/'

export function clipBlobPathname(setId: string, originalFilename: string): string {
  const safeName = originalFilename.replace(/[/\\]/g, '_').replace(/\0/g, '')
  return `${VIDEO_TOOLS_BLOB_PREFIX}${setId}/clips/${crypto.randomUUID()}-${safeName}`
}

export function mergedBlobPathname(setId: string, outputFilename: string): string {
  return `${VIDEO_TOOLS_BLOB_PREFIX}${setId}/merged/${outputFilename}`
}
