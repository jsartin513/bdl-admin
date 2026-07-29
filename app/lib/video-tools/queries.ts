import { asc, desc, eq, sql } from 'drizzle-orm'
import { getDb } from '@/app/lib/db'
import { videoUploadClips, videoUploadSets } from '@/app/db/schema'
import { displayTitle } from '@/app/lib/video-tools/naming'
import type {
  VideoUploadClipRecord,
  VideoUploadSetDetail,
  VideoUploadSetListItem,
  VideoUploadSetRecord,
} from '@/app/lib/video-tools/types'

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

export async function listVideoUploadSets(): Promise<VideoUploadSetListItem[]> {
  const db = getDb()
  const rows = await db
    .select({
      set: videoUploadSets,
      clipCount: sql<number>`cast(count(${videoUploadClips.id}) as int)`,
    })
    .from(videoUploadSets)
    .leftJoin(videoUploadClips, eq(videoUploadClips.setId, videoUploadSets.id))
    .groupBy(videoUploadSets.id)
    .orderBy(desc(videoUploadSets.createdAt))

  return rows.map(({ set, clipCount }) => {
    const mapped = mapSet(set)
    return {
      ...mapped,
      clipCount: Number(clipCount) || 0,
      displayTitle: displayTitle(mapped.eventName, mapped.label),
    }
  })
}

export async function getVideoUploadSet(id: string): Promise<VideoUploadSetDetail | null> {
  const db = getDb()
  const [set] = await db
    .select()
    .from(videoUploadSets)
    .where(eq(videoUploadSets.id, id))
    .limit(1)
  if (!set) return null

  const clips = await db
    .select()
    .from(videoUploadClips)
    .where(eq(videoUploadClips.setId, id))
    .orderBy(
      asc(videoUploadClips.sortIndex),
      asc(videoUploadClips.createdAt)
    )

  const mapped = mapSet(set)
  return {
    ...mapped,
    displayTitle: displayTitle(mapped.eventName, mapped.label),
    clips: clips.map(mapClip),
  }
}

export async function listClipsForSet(setId: string): Promise<VideoUploadClipRecord[]> {
  const db = getDb()
  const clips = await db
    .select()
    .from(videoUploadClips)
    .where(eq(videoUploadClips.setId, setId))
    .orderBy(
      asc(videoUploadClips.sortIndex),
      asc(videoUploadClips.createdAt)
    )
  return clips.map(mapClip)
}
