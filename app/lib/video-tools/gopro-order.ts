/**
 * GoPro-aware clip ordering (ported from combine_week_courts.sh / combine_gopro_videos.sh).
 *
 * - Session id = last 4 digits of GXnnSSSS / GPnnSSSS / GOPRSSSS
 * - Sessions sorted numerically
 * - Within a session: GOPR → GP → GX, then by full basename (chapter order)
 * - Non-GoPro files: lexicographic basename, after all GoPro sessions
 */

export type OrderedClip = {
  originalFilename: string
  basename: string
}

type GoProParsed = {
  kind: 'GOPR' | 'GP' | 'GX'
  sessionId: string
  basename: string
}

const GOPR_RE = /^GOPR(\d{4})\.(mp4|mov)$/i
const GP_RE = /^GP(\d{2})(\d{4})\.(mp4|mov)$/i
const GX_RE = /^GX(\d{2})(\d{4})\.(mp4|mov)$/i

function basenameOf(filename: string): string {
  const parts = filename.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || filename
}

function parseGoPro(basename: string): GoProParsed | null {
  let m = basename.match(GOPR_RE)
  if (m) {
    return { kind: 'GOPR', sessionId: m[1], basename }
  }
  m = basename.match(GP_RE)
  if (m) {
    return { kind: 'GP', sessionId: m[2], basename }
  }
  m = basename.match(GX_RE)
  if (m) {
    return { kind: 'GX', sessionId: m[2], basename }
  }
  return null
}

const KIND_ORDER: Record<GoProParsed['kind'], number> = {
  GOPR: 0,
  GP: 1,
  GX: 2,
}

function compareGoPro(a: GoProParsed, b: GoProParsed): number {
  if (a.sessionId !== b.sessionId) {
    return a.sessionId.localeCompare(b.sessionId, undefined, { numeric: true })
  }
  const kindDiff = KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
  if (kindDiff !== 0) return kindDiff
  return a.basename.localeCompare(b.basename, undefined, {
    numeric: true,
    sensitivity: 'base',
  })
}

/** Return clips sorted in concat order. Preserves object identity / extra fields. */
export function orderClipsForMerge<T extends { originalFilename: string }>(
  clips: T[]
): T[] {
  const withMeta = clips.map((clip, index) => {
    const basename = basenameOf(clip.originalFilename)
    const gopro = parseGoPro(basename)
    return { clip, index, basename, gopro }
  })

  const goproItems = withMeta.filter((x) => x.gopro)
  const otherItems = withMeta.filter((x) => !x.gopro)

  goproItems.sort((a, b) => {
    const cmp = compareGoPro(a.gopro!, b.gopro!)
    if (cmp !== 0) return cmp
    return a.index - b.index
  })

  otherItems.sort((a, b) => {
    const cmp = a.basename.localeCompare(b.basename, undefined, {
      numeric: true,
      sensitivity: 'base',
    })
    if (cmp !== 0) return cmp
    return a.index - b.index
  })

  return [...goproItems, ...otherItems].map((x) => x.clip)
}

export function extractGoProSessionId(filename: string): string | null {
  return parseGoPro(basenameOf(filename))?.sessionId ?? null
}
