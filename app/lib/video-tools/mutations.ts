import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'
import { getDb } from '@/app/lib/db'
import { videoUploadClips, videoUploadSets } from '@/app/db/schema'
import {
  assertSafeVideoClipBlobUrl,
  assertSafeVideoMergedBlobUrl,
} from '@/app/lib/video-tools/blob-url'
import { orderClipsForMerge } from '@/app/lib/video-tools/gopro-order'
import {
  buildUntrimmedOutputFilename,
  displayTitle,
} from '@/app/lib/video-tools/naming'
import { listClipsForSet } from '@/app/lib/video-tools/queries'
import type {
  VideoSetStatus,
  VideoUploadClipRecord,
  VideoUploadSetDetail,
  VideoUploadSetRecord,
  WorkerClaimPayload,
} from '@/app/lib/video-tools/types'
import { isValidVideoSetStatus } from '@/app/lib/video-tools/types'

function parseEventDate(value: string): string {
  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error('eventDate must be YYYY-MM-DD')
  }
  const d = new Date(`${trimmed}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) {
    throw new Error('eventDate is not a valid date')
  }
  if (d.toISOString().slice(0, 10) !== trimmed) {
    throw new Error('eventDate is not a valid date')
  }
  return trimmed
}

function mapSet(row: typeof videoUploadSets.$inferSelect): VideoUploadSetRecord {
  return {
    id: row.id,
    eventName: row.eventName,
    label: row.label,
    eventDate: row.eventDate,
    status: row.status,
    createdByEmail: row.createdByEmail,
    errorMessage: row.errorMessage,
    mergedBlobUrl: row.mergedBlobUrl,
    mergedBlobPathname: row.mergedBlobPathname,
    outputFilename: row.outputFilename,
    pendingUploadCount: row.pendingUploadCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

function mapClip(row: typeof videoUploadClips.$inferSelect): VideoUploadClipRecord {
  return {
    id: row.id,
    setId: row.setId,
    originalFilename: row.originalFilename,
    blobUrl: row.blobUrl,
    pathname: row.pathname,
    sizeBytes: row.sizeBytes,
    sortIndex: row.sortIndex,
    uploadComplete: row.uploadComplete,
    createdAt: row.createdAt,
  }
}

export async function createVideoUploadSet(input: {
  eventName: string
  label: string
  eventDate: string
  createdByEmail: string
}): Promise<VideoUploadSetDetail> {
  const eventName = input.eventName.trim()
  const label = input.label.trim()
  if (!eventName) throw new Error('eventName is required')
  if (!label) throw new Error('label is required')
  const eventDate = parseEventDate(input.eventDate)
  const createdByEmail = input.createdByEmail.trim().toLowerCase()
  if (!createdByEmail) throw new Error('createdByEmail is required')

  const db = getDb()
  const outputFilename = buildUntrimmedOutputFilename({
    eventName,
    eventDate,
    label,
  })

  const [created] = await db
    .insert(videoUploadSets)
    .values({
      eventName,
      label,
      eventDate,
      status: 'draft',
      createdByEmail,
      outputFilename,
    })
    .returning()

  const mapped = mapSet(created)
  return {
    ...mapped,
    displayTitle: displayTitle(mapped.eventName, mapped.label),
    clips: [],
  }
}

export async function markSetUploading(setId: string): Promise<void> {
  const db = getDb()
  await db
    .update(videoUploadSets)
    .set({ status: 'uploading', updatedAt: new Date(), errorMessage: null })
    .where(
      and(
        eq(videoUploadSets.id, setId),
        eq(videoUploadSets.status, 'draft')
      )
    )
}

export const READY_ALLOWED_STATUSES = ['draft', 'uploading', 'ready', 'failed'] as const
/** Allow clip registration while queued so in-flight multipart uploads can finish before claim. */
export const CLIP_LOCKED_STATUSES = ['processing', 'complete'] as const
/** New upload tokens only while actively collecting clips. */
export const UPLOAD_TOKEN_ALLOWED_STATUSES = ['draft', 'uploading', 'failed'] as const
/** ready = normal; failed/processing = operator retry for stuck or failed merges. */
export const ENQUEUE_ALLOWED_STATUSES = ['ready', 'failed', 'processing'] as const

function isUniquePathnameError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const code = 'code' in err ? String(err.code) : ''
  const message = 'message' in err ? String(err.message) : ''
  return (
    code === '23505' ||
    message.includes('video_upload_clips_pathname_uidx') ||
    message.toLowerCase().includes('unique')
  )
}

/** Reserve an in-flight upload slot when minting a Blob client token. */
export async function beginPendingClipUpload(setId: string): Promise<void> {
  const db = getDb()
  const [updated] = await db
    .update(videoUploadSets)
    .set({
      pendingUploadCount: sql`${videoUploadSets.pendingUploadCount} + 1`,
      status: 'uploading',
      updatedAt: new Date(),
      errorMessage: null,
    })
    .where(
      and(
        eq(videoUploadSets.id, setId),
        inArray(videoUploadSets.status, [...UPLOAD_TOKEN_ALLOWED_STATUSES])
      )
    )
    .returning()

  if (!updated) {
    throw new Error('Cannot upload clips in the current set status')
  }
}

async function releasePendingClipUpload(setId: string): Promise<void> {
  const db = getDb()
  await db
    .update(videoUploadSets)
    .set({
      pendingUploadCount: sql`greatest(${videoUploadSets.pendingUploadCount} - 1, 0)`,
      updatedAt: new Date(),
    })
    .where(eq(videoUploadSets.id, setId))
}

export async function recordUploadedClip(input: {
  setId: string
  originalFilename: string
  blobUrl: string
  pathname: string
  sizeBytes?: number
}): Promise<VideoUploadClipRecord> {
  const db = getDb()
  const safeBlobUrl = assertSafeVideoClipBlobUrl(
    input.blobUrl,
    input.pathname,
    input.setId
  )
  const incomingSize =
    typeof input.sizeBytes === 'number' && input.sizeBytes > 0
      ? Math.floor(input.sizeBytes)
      : 0

  async function reconcileExisting(
    existing: typeof videoUploadClips.$inferSelect
  ): Promise<VideoUploadClipRecord> {
    if (existing.setId !== input.setId) {
      throw new Error('Clip pathname already belongs to another upload set')
    }
    const needsUrl = existing.blobUrl !== safeBlobUrl
    const needsSize = incomingSize > 0 && incomingSize > existing.sizeBytes
    if (!needsUrl && !needsSize) {
      return mapClip(existing)
    }
    const [updated] = await db
      .update(videoUploadClips)
      .set({
        ...(needsUrl ? { blobUrl: safeBlobUrl } : {}),
        ...(incomingSize > 0
          ? {
              sizeBytes: sql`greatest(${videoUploadClips.sizeBytes}, ${incomingSize})`,
            }
          : {}),
        uploadComplete: true,
      })
      .where(eq(videoUploadClips.id, existing.id))
      .returning()
    return mapClip(updated)
  }

  const [existing] = await db
    .select()
    .from(videoUploadClips)
    .where(eq(videoUploadClips.pathname, input.pathname))
    .limit(1)
  if (existing) {
    return reconcileExisting(existing)
  }

  const [set] = await db
    .select()
    .from(videoUploadSets)
    .where(eq(videoUploadSets.id, input.setId))
    .limit(1)
  if (!set) throw new Error('Upload set not found')
  if ((CLIP_LOCKED_STATUSES as readonly string[]).includes(set.status)) {
    throw new Error(`Cannot add clips while set is ${set.status}`)
  }

  let clip: typeof videoUploadClips.$inferSelect
  try {
    const [inserted] = await db
      .insert(videoUploadClips)
      .values({
        setId: input.setId,
        originalFilename: input.originalFilename,
        blobUrl: safeBlobUrl,
        pathname: input.pathname,
        sizeBytes: incomingSize,
        uploadComplete: true,
      })
      .returning()
    clip = inserted
  } catch (err) {
    if (!isUniquePathnameError(err)) throw err
    const [raced] = await db
      .select()
      .from(videoUploadClips)
      .where(eq(videoUploadClips.pathname, input.pathname))
      .limit(1)
    if (!raced) throw err
    return reconcileExisting(raced)
  }

  await releasePendingClipUpload(input.setId)

  // Conditional updates only — never clobber queued/processing/complete if the
  // set advanced between the initial read and this write (Start merge race).
  await db
    .update(videoUploadSets)
    .set({ updatedAt: new Date() })
    .where(
      and(
        eq(videoUploadSets.id, input.setId),
        eq(videoUploadSets.status, 'queued')
      )
    )

  // Only demote statuses we were admitted under. Do not include `failed` unless
  // this request started against a failed set (retry upload); otherwise a
  // queued→failed race could clear the merge error.
  const demoteFrom =
    set.status === 'failed'
      ? (['draft', 'ready', 'uploading', 'failed'] as const)
      : (['draft', 'ready', 'uploading'] as const)

  await db
    .update(videoUploadSets)
    .set({
      status: 'uploading',
      updatedAt: new Date(),
      errorMessage: null,
    })
    .where(
      and(
        eq(videoUploadSets.id, input.setId),
        inArray(videoUploadSets.status, [...demoteFrom])
      )
    )

  return mapClip(clip)
}

export async function markSetReady(setId: string): Promise<VideoUploadSetRecord> {
  const db = getDb()
  const [set] = await db
    .select()
    .from(videoUploadSets)
    .where(eq(videoUploadSets.id, setId))
    .limit(1)
  if (!set) throw new Error('Upload set not found')
  if (!(READY_ALLOWED_STATUSES as readonly string[]).includes(set.status)) {
    throw new Error(`Cannot mark ready while set is ${set.status}`)
  }
  if (set.pendingUploadCount > 0) {
    throw new Error(
      `Wait for ${set.pendingUploadCount} in-flight upload(s) to finish before marking ready`
    )
  }

  const clips = await listClipsForSet(setId)
  if (clips.length === 0) {
    throw new Error('Add at least one clip before marking ready')
  }

  const ordered = orderClipsForMerge(clips)
  for (let i = 0; i < ordered.length; i++) {
    await db
      .update(videoUploadClips)
      .set({ sortIndex: i })
      .where(eq(videoUploadClips.id, ordered[i].id))
  }

  const [updated] = await db
    .update(videoUploadSets)
    .set({
      status: 'ready',
      updatedAt: new Date(),
      errorMessage: null,
    })
    .where(
      and(
        eq(videoUploadSets.id, setId),
        // Re-check so we never clobber queued/processing/complete mid-flight.
        eq(videoUploadSets.status, set.status),
        eq(videoUploadSets.pendingUploadCount, 0)
      )
    )
    .returning()

  if (!updated) {
    throw new Error(
      'Upload set changed or uploads are still in progress; cannot mark ready'
    )
  }
  return mapSet(updated)
}

export async function enqueueVideoUploadSet(
  setId: string
): Promise<VideoUploadSetRecord> {
  const db = getDb()
  const [set] = await db
    .select()
    .from(videoUploadSets)
    .where(eq(videoUploadSets.id, setId))
    .limit(1)
  if (!set) throw new Error('Upload set not found')

  if (!(ENQUEUE_ALLOWED_STATUSES as readonly string[]).includes(set.status)) {
    throw new Error(`Cannot enqueue set in status ${set.status}`)
  }
  if (set.pendingUploadCount > 0) {
    throw new Error(
      `Wait for ${set.pendingUploadCount} in-flight upload(s) to finish before starting merge`
    )
  }

  const clips = await listClipsForSet(setId)
  if (clips.length === 0) {
    throw new Error('Cannot enqueue a set with no clips')
  }

  // Refresh GoPro order before queueing
  const ordered = orderClipsForMerge(clips)
  for (let i = 0; i < ordered.length; i++) {
    await db
      .update(videoUploadClips)
      .set({ sortIndex: i })
      .where(eq(videoUploadClips.id, ordered[i].id))
  }

  const outputFilename =
    set.outputFilename ||
    buildUntrimmedOutputFilename({
      eventName: set.eventName,
      eventDate: set.eventDate,
      label: set.label,
    })

  const [updated] = await db
    .update(videoUploadSets)
    .set({
      status: 'queued',
      updatedAt: new Date(),
      errorMessage: null,
      outputFilename,
      mergedBlobUrl: null,
      mergedBlobPathname: null,
      // Invalidate any in-flight worker claim so a stale complete cannot win.
      claimToken: null,
    })
    .where(
      and(
        eq(videoUploadSets.id, setId),
        inArray(videoUploadSets.status, [...ENQUEUE_ALLOWED_STATUSES]),
        eq(videoUploadSets.pendingUploadCount, 0)
      )
    )
    .returning()

  if (!updated) {
    throw new Error(
      'Upload set status changed or uploads are still in progress; cannot enqueue'
    )
  }
  return mapSet(updated)
}

/** Optimistic claim of the oldest queued set. */
export async function claimNextQueuedSet(): Promise<WorkerClaimPayload | null> {
  const db = getDb()
  const [next] = await db
    .select()
    .from(videoUploadSets)
    .where(eq(videoUploadSets.status, 'queued'))
    .orderBy(asc(videoUploadSets.createdAt))
    .limit(1)

  if (!next) return null

  const claimToken = randomUUID()
  const [claimed] = await db
    .update(videoUploadSets)
    .set({
      status: 'processing',
      updatedAt: new Date(),
      errorMessage: null,
      claimToken,
    })
    .where(
      and(
        eq(videoUploadSets.id, next.id),
        eq(videoUploadSets.status, 'queued')
      )
    )
    .returning()

  if (!claimed) return null

  const clips = await listClipsForSet(claimed.id)
  const ordered = orderClipsForMerge(clips)

  try {
    for (const clip of ordered) {
      assertSafeVideoClipBlobUrl(clip.blobUrl, clip.pathname, claimed.id)
    }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Invalid clip blob URL at claim'
    await failVideoUploadSet({
      setId: claimed.id,
      claimToken,
      errorMessage: `Refusing to merge: ${message}`,
    })
    return null
  }

  const outputFilename =
    claimed.outputFilename ||
    buildUntrimmedOutputFilename({
      eventName: claimed.eventName,
      eventDate: claimed.eventDate,
      label: claimed.label,
    })

  return {
    set: mapSet(claimed),
    clips: ordered,
    outputFilename,
    claimToken,
  }
}

export async function completeVideoUploadSet(input: {
  setId: string
  claimToken: string
  mergedBlobUrl: string
  mergedBlobPathname: string
  outputFilename?: string
}): Promise<VideoUploadSetRecord> {
  const claimToken = input.claimToken.trim()
  if (!claimToken) throw new Error('claimToken is required')

  const db = getDb()
  const [current] = await db
    .select()
    .from(videoUploadSets)
    .where(eq(videoUploadSets.id, input.setId))
    .limit(1)
  if (!current) throw new Error('Upload set not found')

  const outputFilename =
    input.outputFilename?.trim() ||
    current.outputFilename ||
    buildUntrimmedOutputFilename({
      eventName: current.eventName,
      eventDate: current.eventDate,
      label: current.label,
    })

  const safeMergedUrl = assertSafeVideoMergedBlobUrl({
    blobUrl: input.mergedBlobUrl,
    pathname: input.mergedBlobPathname,
    setId: input.setId,
    outputFilename,
  })

  const [updated] = await db
    .update(videoUploadSets)
    .set({
      status: 'complete',
      updatedAt: new Date(),
      errorMessage: null,
      mergedBlobUrl: safeMergedUrl,
      mergedBlobPathname: input.mergedBlobPathname.trim(),
      outputFilename,
    })
    .where(
      and(
        eq(videoUploadSets.id, input.setId),
        eq(videoUploadSets.status, 'processing'),
        eq(videoUploadSets.claimToken, claimToken)
      )
    )
    .returning()

  if (!updated) {
    throw new Error('Set not found, not processing, or stale claim token')
  }
  return mapSet(updated)
}

export async function failVideoUploadSet(input: {
  setId: string
  claimToken: string
  errorMessage: string
}): Promise<VideoUploadSetRecord> {
  const claimToken = input.claimToken.trim()
  if (!claimToken) throw new Error('claimToken is required')

  const db = getDb()
  const [updated] = await db
    .update(videoUploadSets)
    .set({
      status: 'failed',
      updatedAt: new Date(),
      errorMessage: input.errorMessage.slice(0, 2000),
    })
    .where(
      and(
        eq(videoUploadSets.id, input.setId),
        eq(videoUploadSets.status, 'processing'),
        eq(videoUploadSets.claimToken, claimToken)
      )
    )
    .returning()

  if (updated) return mapSet(updated)

  const [existing] = await db
    .select()
    .from(videoUploadSets)
    .where(eq(videoUploadSets.id, input.setId))
    .limit(1)
  if (!existing) throw new Error('Upload set not found')
  // Idempotent / race-safe: do not overwrite a successful complete (or prior fail).
  if (existing.status === 'complete' || existing.status === 'failed') {
    return mapSet(existing)
  }
  // Another claim owns this set (retry / second worker) — do not mutate.
  if (
    existing.status === 'processing' &&
    existing.claimToken &&
    existing.claimToken !== claimToken
  ) {
    throw new Error('Stale claim token')
  }
  throw new Error(`Set not found or not processing (status: ${existing.status})`)
}

export async function updateVideoUploadSetStatus(
  setId: string,
  status: VideoSetStatus
): Promise<VideoUploadSetRecord> {
  if (!isValidVideoSetStatus(status)) {
    throw new Error('Invalid status')
  }
  const db = getDb()
  const [updated] = await db
    .update(videoUploadSets)
    .set({ status, updatedAt: new Date() })
    .where(eq(videoUploadSets.id, setId))
    .returning()
  if (!updated) throw new Error('Upload set not found')
  return mapSet(updated)
}
