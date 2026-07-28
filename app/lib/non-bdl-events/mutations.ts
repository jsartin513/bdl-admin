import { and, desc, eq } from 'drizzle-orm'
import { del, put } from '@vercel/blob'
import { getDb } from '@/app/lib/db'
import {
  nonBdlEventAttendees,
  nonBdlEventPhotoPlayerTags,
  nonBdlEventPhotos,
  nonBdlEventPhotoTeamTags,
  nonBdlEvents,
  nonBdlEventStories,
  nonBdlEventStoryPlayerTags,
  nonBdlEventStoryTeamTags,
  nonBdlEventTeams,
  players,
} from '@/app/db/schema'
import { parseEventDate } from '@/app/lib/events/mutations'
import {
  assertPlayersAttendEvent,
  assertTeamBelongsToEvent,
  assertTeamsBelongToEvent,
  getNonBdlEvent,
} from '@/app/lib/non-bdl-events/queries'
import {
  isValidBallType,
  parseHostOrgForCreate,
  parseHostOrgPatch,
  type BallType,
  type NonBdlEventPhotoItem,
  type NonBdlEventRecord,
  type NonBdlEventStoryItem,
  type NonBdlEventTeamItem,
} from '@/app/lib/non-bdl-events/types'

const PHOTO_BLOB_PREFIX = 'non-bdl-event-photos/'

const ALLOWED_BLOB_HOST_SUFFIXES = ['.blob.vercel-storage.com']

function isVercelBlobHost(hostname: string): boolean {
  return ALLOWED_BLOB_HOST_SUFFIXES.some(
    (suffix) => hostname === suffix.slice(1) || hostname.endsWith(suffix)
  )
}

function normalizeBlobPathname(pathname: string): string {
  return pathname.startsWith('/') ? pathname.slice(1) : pathname
}

function isUnderPhotoPrefix(pathname: string): boolean {
  return normalizeBlobPathname(pathname).startsWith(PHOTO_BLOB_PREFIX)
}

function isImageFile(file: File): boolean {
  const name = file.name.toLowerCase()
  const type = file.type.toLowerCase()
  return (
    type.startsWith('image/') ||
    name.endsWith('.jpg') ||
    name.endsWith('.jpeg') ||
    name.endsWith('.png') ||
    name.endsWith('.webp') ||
    name.endsWith('.gif')
  )
}

function imageContentType(file: File): string {
  if (file.type && file.type.startsWith('image/')) return file.type
  const name = file.name.toLowerCase()
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.webp')) return 'image/webp'
  if (name.endsWith('.gif')) return 'image/gif'
  return 'image/jpeg'
}

function extensionForFile(file: File): string {
  const name = file.name.toLowerCase()
  const match = name.match(/\.(jpe?g|png|webp|gif)$/)
  if (match) return match[1] === 'jpeg' ? 'jpg' : match[1]
  const type = file.type.toLowerCase()
  if (type.includes('png')) return 'png'
  if (type.includes('webp')) return 'webp'
  if (type.includes('gif')) return 'gif'
  return 'jpg'
}

export async function createNonBdlEvent(input: {
  name: string
  eventDate: string
  ballType?: string | null
  division?: string | null
  city?: string | null
  hostOrgHomeLeague?: string | null
  hostOrgName?: string | null
  notes?: string | null
}): Promise<NonBdlEventRecord> {
  const db = getDb()
  const name = input.name.trim()
  if (!name) throw new Error('name is required')

  const eventDate = parseEventDate(input.eventDate)
  let ballType: BallType = 'foam'
  if (input.ballType != null && input.ballType !== '') {
    if (!isValidBallType(input.ballType)) throw new Error('Invalid ballType')
    ballType = input.ballType
  }

  const { hostOrgHomeLeague, hostOrgName } = parseHostOrgForCreate({
    hostOrgHomeLeague: input.hostOrgHomeLeague,
    hostOrgName: input.hostOrgName,
  })

  const division = input.division?.trim() ? input.division.trim() : null
  const city = input.city?.trim() ? input.city.trim() : null
  const notes = input.notes?.trim() ? input.notes.trim() : null

  const [created] = await db
    .insert(nonBdlEvents)
    .values({
      name,
      eventDate,
      ballType,
      division,
      city,
      hostOrgHomeLeague,
      hostOrgName,
      notes,
    })
    .returning()

  return created
}

export async function updateNonBdlEvent(
  id: string,
  patch: {
    name?: string
    eventDate?: string
    ballType?: string | null
    division?: string | null
    city?: string | null
    hostOrgHomeLeague?: string | null
    hostOrgName?: string | null
    notes?: string | null
  }
): Promise<NonBdlEventRecord> {
  const db = getDb()
  const existing = await getNonBdlEvent(id)
  if (!existing) throw new Error('Event not found')

  const updates: {
    name?: string
    eventDate?: string
    ballType?: string
    division?: string | null
    city?: string | null
    hostOrgHomeLeague?: string | null
    hostOrgName?: string | null
    notes?: string | null
    updatedAt: Date
  } = { updatedAt: new Date() }

  if (patch.name !== undefined) {
    const name = patch.name.trim()
    if (!name) throw new Error('name is required')
    updates.name = name
  }
  if (patch.eventDate !== undefined) {
    updates.eventDate = parseEventDate(patch.eventDate)
  }
  if (patch.ballType !== undefined) {
    if (patch.ballType == null || patch.ballType === '') {
      updates.ballType = 'foam'
    } else if (!isValidBallType(patch.ballType)) {
      throw new Error('Invalid ballType')
    } else {
      updates.ballType = patch.ballType
    }
  }
  if (patch.division !== undefined) {
    updates.division =
      patch.division == null || patch.division.trim() === ''
        ? null
        : patch.division.trim()
  }
  if (patch.city !== undefined) {
    updates.city =
      patch.city == null || patch.city.trim() === '' ? null : patch.city.trim()
  }
  if (patch.notes !== undefined) {
    updates.notes =
      patch.notes == null || patch.notes.trim() === '' ? null : patch.notes.trim()
  }

  const hostPatch = parseHostOrgPatch(patch, {
    hostOrgHomeLeague: existing.hostOrgHomeLeague,
    hostOrgName: existing.hostOrgName,
  })
  if (hostPatch) {
    updates.hostOrgHomeLeague = hostPatch.hostOrgHomeLeague
    updates.hostOrgName = hostPatch.hostOrgName
  }

  const [updated] = await db
    .update(nonBdlEvents)
    .set(updates)
    .where(eq(nonBdlEvents.id, id))
    .returning()

  if (!updated) throw new Error('Event not found')
  return updated
}

export async function deleteNonBdlEvent(id: string): Promise<void> {
  const db = getDb()
  const photoRows = await db
    .select({ pathname: nonBdlEventPhotos.pathname, blobUrl: nonBdlEventPhotos.blobUrl })
    .from(nonBdlEventPhotos)
    .where(eq(nonBdlEventPhotos.eventId, id))

  const [deleted] = await db
    .delete(nonBdlEvents)
    .where(eq(nonBdlEvents.id, id))
    .returning({ id: nonBdlEvents.id })
  if (!deleted) throw new Error('Event not found')

  for (const photo of photoRows) {
    try {
      if (isUnderPhotoPrefix(photo.pathname)) {
        await del(photo.pathname)
      } else if (photo.blobUrl) {
        const parsed = new URL(photo.blobUrl)
        if (isVercelBlobHost(parsed.hostname)) {
          await del(photo.blobUrl)
        }
      }
    } catch {
      // Best-effort blob cleanup
    }
  }
}

export async function createNonBdlEventTeam(input: {
  eventId: string
  name: string
  resultText?: string | null
}): Promise<NonBdlEventTeamItem> {
  const db = getDb()
  const event = await getNonBdlEvent(input.eventId)
  if (!event) throw new Error('Event not found')

  const name = input.name.trim()
  if (!name) throw new Error('name is required')
  const resultText =
    input.resultText == null || input.resultText.trim() === ''
      ? null
      : input.resultText.trim()

  const [created] = await db
    .insert(nonBdlEventTeams)
    .values({ eventId: input.eventId, name, resultText })
    .returning()
  return created
}

export async function updateNonBdlEventTeam(
  eventId: string,
  teamId: string,
  patch: { name?: string; resultText?: string | null }
): Promise<NonBdlEventTeamItem> {
  await assertTeamBelongsToEvent(eventId, teamId)
  const db = getDb()
  const updates: {
    name?: string
    resultText?: string | null
    updatedAt: Date
  } = { updatedAt: new Date() }

  if (patch.name !== undefined) {
    const name = patch.name.trim()
    if (!name) throw new Error('name is required')
    updates.name = name
  }
  if (patch.resultText !== undefined) {
    updates.resultText =
      patch.resultText == null || patch.resultText.trim() === ''
        ? null
        : patch.resultText.trim()
  }

  const [updated] = await db
    .update(nonBdlEventTeams)
    .set(updates)
    .where(
      and(eq(nonBdlEventTeams.id, teamId), eq(nonBdlEventTeams.eventId, eventId))
    )
    .returning()
  if (!updated) throw new Error('Team not found')
  return updated
}

export async function deleteNonBdlEventTeam(
  eventId: string,
  teamId: string
): Promise<void> {
  await assertTeamBelongsToEvent(eventId, teamId)
  const db = getDb()
  await db
    .delete(nonBdlEventTeams)
    .where(
      and(eq(nonBdlEventTeams.id, teamId), eq(nonBdlEventTeams.eventId, eventId))
    )
}

export async function addNonBdlEventAttendee(input: {
  eventId: string
  playerId: string
  teamId?: string | null
  notes?: string | null
}): Promise<{ id: string; created: boolean }> {
  const db = getDb()
  const event = await getNonBdlEvent(input.eventId)
  if (!event) throw new Error('Event not found')

  const [player] = await db
    .select({ id: players.id, isMerged: players.isMerged })
    .from(players)
    .where(eq(players.id, input.playerId))
    .limit(1)
  if (!player) throw new Error('Player not found')
  if (player.isMerged) throw new Error('Cannot add a merged player')

  if (input.teamId) {
    await assertTeamBelongsToEvent(input.eventId, input.teamId)
  }

  const notes =
    input.notes == null || input.notes.trim() === '' ? null : input.notes.trim()

  const [existing] = await db
    .select({ id: nonBdlEventAttendees.id })
    .from(nonBdlEventAttendees)
    .where(
      and(
        eq(nonBdlEventAttendees.eventId, input.eventId),
        eq(nonBdlEventAttendees.playerId, input.playerId)
      )
    )
    .limit(1)

  if (existing) {
    const updates: {
      teamId?: string | null
      notes?: string | null
      updatedAt: Date
    } = { updatedAt: new Date() }
    if (input.teamId !== undefined) {
      updates.teamId = input.teamId || null
    }
    if (input.notes !== undefined) {
      updates.notes = notes
    }
    await db
      .update(nonBdlEventAttendees)
      .set(updates)
      .where(eq(nonBdlEventAttendees.id, existing.id))
    return { id: existing.id, created: false }
  }

  const [created] = await db
    .insert(nonBdlEventAttendees)
    .values({
      eventId: input.eventId,
      playerId: input.playerId,
      teamId: input.teamId || null,
      notes,
    })
    .returning({ id: nonBdlEventAttendees.id })

  return { id: created.id, created: true }
}

export async function updateNonBdlEventAttendee(
  eventId: string,
  attendeeId: string,
  patch: { teamId?: string | null; notes?: string | null }
): Promise<void> {
  const db = getDb()
  const [existing] = await db
    .select()
    .from(nonBdlEventAttendees)
    .where(
      and(
        eq(nonBdlEventAttendees.id, attendeeId),
        eq(nonBdlEventAttendees.eventId, eventId)
      )
    )
    .limit(1)
  if (!existing) throw new Error('Attendee not found')

  const updates: {
    teamId?: string | null
    notes?: string | null
    updatedAt: Date
  } = { updatedAt: new Date() }

  if (patch.teamId !== undefined) {
    if (patch.teamId) {
      await assertTeamBelongsToEvent(eventId, patch.teamId)
      updates.teamId = patch.teamId
    } else {
      updates.teamId = null
    }
  }
  if (patch.notes !== undefined) {
    updates.notes =
      patch.notes == null || patch.notes.trim() === ''
        ? null
        : patch.notes.trim()
  }

  await db
    .update(nonBdlEventAttendees)
    .set(updates)
    .where(eq(nonBdlEventAttendees.id, attendeeId))
}

export async function deleteNonBdlEventAttendee(
  eventId: string,
  attendeeId: string
): Promise<void> {
  const db = getDb()
  const [deleted] = await db
    .delete(nonBdlEventAttendees)
    .where(
      and(
        eq(nonBdlEventAttendees.id, attendeeId),
        eq(nonBdlEventAttendees.eventId, eventId)
      )
    )
    .returning({ id: nonBdlEventAttendees.id })
  if (!deleted) throw new Error('Attendee not found')
}

async function replaceStoryTags(
  storyId: string,
  eventId: string,
  teamIds: string[],
  playerIds: string[]
): Promise<void> {
  await assertTeamsBelongToEvent(eventId, teamIds)
  await assertPlayersAttendEvent(eventId, playerIds)

  const db = getDb()
  await db
    .delete(nonBdlEventStoryTeamTags)
    .where(eq(nonBdlEventStoryTeamTags.storyId, storyId))
  await db
    .delete(nonBdlEventStoryPlayerTags)
    .where(eq(nonBdlEventStoryPlayerTags.storyId, storyId))

  const uniqueTeams = [...new Set(teamIds)]
  const uniquePlayers = [...new Set(playerIds)]
  if (uniqueTeams.length > 0) {
    await db.insert(nonBdlEventStoryTeamTags).values(
      uniqueTeams.map((teamId) => ({ storyId, teamId }))
    )
  }
  if (uniquePlayers.length > 0) {
    await db.insert(nonBdlEventStoryPlayerTags).values(
      uniquePlayers.map((playerId) => ({ storyId, playerId }))
    )
  }
}

async function replacePhotoTags(
  photoId: string,
  eventId: string,
  teamIds: string[],
  playerIds: string[]
): Promise<void> {
  await assertTeamsBelongToEvent(eventId, teamIds)
  await assertPlayersAttendEvent(eventId, playerIds)

  const db = getDb()
  await db
    .delete(nonBdlEventPhotoTeamTags)
    .where(eq(nonBdlEventPhotoTeamTags.photoId, photoId))
  await db
    .delete(nonBdlEventPhotoPlayerTags)
    .where(eq(nonBdlEventPhotoPlayerTags.photoId, photoId))

  const uniqueTeams = [...new Set(teamIds)]
  const uniquePlayers = [...new Set(playerIds)]
  if (uniqueTeams.length > 0) {
    await db.insert(nonBdlEventPhotoTeamTags).values(
      uniqueTeams.map((teamId) => ({ photoId, teamId }))
    )
  }
  if (uniquePlayers.length > 0) {
    await db.insert(nonBdlEventPhotoPlayerTags).values(
      uniquePlayers.map((playerId) => ({ photoId, playerId }))
    )
  }
}

export async function createNonBdlEventStory(input: {
  eventId: string
  title?: string | null
  body: string
  sortOrder?: number
  teamIds?: string[]
  playerIds?: string[]
}): Promise<NonBdlEventStoryItem> {
  const db = getDb()
  const event = await getNonBdlEvent(input.eventId)
  if (!event) throw new Error('Event not found')

  const body = input.body.trim()
  if (!body) throw new Error('body is required')
  const title =
    input.title == null || input.title.trim() === '' ? null : input.title.trim()
  const sortOrder =
    typeof input.sortOrder === 'number' && Number.isFinite(input.sortOrder)
      ? Math.trunc(input.sortOrder)
      : 0
  const teamIds = input.teamIds ?? []
  const playerIds = input.playerIds ?? []

  await assertTeamsBelongToEvent(input.eventId, teamIds)
  await assertPlayersAttendEvent(input.eventId, playerIds)

  const [created] = await db
    .insert(nonBdlEventStories)
    .values({
      eventId: input.eventId,
      title,
      body,
      sortOrder,
    })
    .returning()

  await replaceStoryTags(created.id, input.eventId, teamIds, playerIds)

  return {
    ...created,
    teamIds: [...new Set(teamIds)],
    playerIds: [...new Set(playerIds)],
  }
}

export async function updateNonBdlEventStory(
  eventId: string,
  storyId: string,
  patch: {
    title?: string | null
    body?: string
    sortOrder?: number
    teamIds?: string[]
    playerIds?: string[]
  }
): Promise<NonBdlEventStoryItem> {
  const db = getDb()
  const [existing] = await db
    .select()
    .from(nonBdlEventStories)
    .where(
      and(
        eq(nonBdlEventStories.id, storyId),
        eq(nonBdlEventStories.eventId, eventId)
      )
    )
    .limit(1)
  if (!existing) throw new Error('Story not found')

  const updates: {
    title?: string | null
    body?: string
    sortOrder?: number
    updatedAt: Date
  } = { updatedAt: new Date() }

  if (patch.title !== undefined) {
    updates.title =
      patch.title == null || patch.title.trim() === ''
        ? null
        : patch.title.trim()
  }
  if (patch.body !== undefined) {
    const body = patch.body.trim()
    if (!body) throw new Error('body is required')
    updates.body = body
  }
  if (patch.sortOrder !== undefined) {
    if (!Number.isFinite(patch.sortOrder)) throw new Error('Invalid sortOrder')
    updates.sortOrder = Math.trunc(patch.sortOrder)
  }

  const [updated] = await db
    .update(nonBdlEventStories)
    .set(updates)
    .where(eq(nonBdlEventStories.id, storyId))
    .returning()

  let teamIds: string[]
  let playerIds: string[]

  if (patch.teamIds !== undefined || patch.playerIds !== undefined) {
    const currentTeamTags = await db
      .select({ teamId: nonBdlEventStoryTeamTags.teamId })
      .from(nonBdlEventStoryTeamTags)
      .where(eq(nonBdlEventStoryTeamTags.storyId, storyId))
    const currentPlayerTags = await db
      .select({ playerId: nonBdlEventStoryPlayerTags.playerId })
      .from(nonBdlEventStoryPlayerTags)
      .where(eq(nonBdlEventStoryPlayerTags.storyId, storyId))

    teamIds = patch.teamIds ?? currentTeamTags.map((t) => t.teamId)
    playerIds = patch.playerIds ?? currentPlayerTags.map((t) => t.playerId)
    await replaceStoryTags(storyId, eventId, teamIds, playerIds)
  } else {
    const currentTeamTags = await db
      .select({ teamId: nonBdlEventStoryTeamTags.teamId })
      .from(nonBdlEventStoryTeamTags)
      .where(eq(nonBdlEventStoryTeamTags.storyId, storyId))
    const currentPlayerTags = await db
      .select({ playerId: nonBdlEventStoryPlayerTags.playerId })
      .from(nonBdlEventStoryPlayerTags)
      .where(eq(nonBdlEventStoryPlayerTags.storyId, storyId))
    teamIds = currentTeamTags.map((t) => t.teamId)
    playerIds = currentPlayerTags.map((t) => t.playerId)
  }

  return {
    ...updated,
    teamIds,
    playerIds,
  }
}

export async function deleteNonBdlEventStory(
  eventId: string,
  storyId: string
): Promise<void> {
  const db = getDb()
  const [deleted] = await db
    .delete(nonBdlEventStories)
    .where(
      and(
        eq(nonBdlEventStories.id, storyId),
        eq(nonBdlEventStories.eventId, eventId)
      )
    )
    .returning({ id: nonBdlEventStories.id })
  if (!deleted) throw new Error('Story not found')
}

export async function uploadNonBdlEventPhoto(input: {
  eventId: string
  file: File
  caption?: string | null
  teamIds?: string[]
  playerIds?: string[]
}): Promise<NonBdlEventPhotoItem> {
  const event = await getNonBdlEvent(input.eventId)
  if (!event) throw new Error('Event not found')
  if (!isImageFile(input.file)) {
    throw new Error('Only image files are supported (jpg, png, webp, gif)')
  }

  const teamIds = input.teamIds ?? []
  const playerIds = input.playerIds ?? []
  await assertTeamsBelongToEvent(input.eventId, teamIds)
  await assertPlayersAttendEvent(input.eventId, playerIds)

  const ext = extensionForFile(input.file)
  const pathname = `${PHOTO_BLOB_PREFIX}${input.eventId}/${crypto.randomUUID()}.${ext}`
  const blob = await put(pathname, input.file, {
    access: 'public',
    addRandomSuffix: false,
    contentType: imageContentType(input.file),
  })

  const caption =
    input.caption == null || input.caption.trim() === ''
      ? null
      : input.caption.trim()

  const db = getDb()
  const existing = await db
    .select({ sortOrder: nonBdlEventPhotos.sortOrder })
    .from(nonBdlEventPhotos)
    .where(eq(nonBdlEventPhotos.eventId, input.eventId))
    .orderBy(desc(nonBdlEventPhotos.sortOrder))
    .limit(1)
  const sortOrder = (existing[0]?.sortOrder ?? -1) + 1

  const [created] = await db
    .insert(nonBdlEventPhotos)
    .values({
      eventId: input.eventId,
      blobUrl: blob.url,
      pathname: blob.pathname,
      caption,
      sortOrder,
    })
    .returning()

  await replacePhotoTags(created.id, input.eventId, teamIds, playerIds)

  return {
    ...created,
    teamIds: [...new Set(teamIds)],
    playerIds: [...new Set(playerIds)],
  }
}

export async function updateNonBdlEventPhoto(
  eventId: string,
  photoId: string,
  patch: {
    caption?: string | null
    sortOrder?: number
    teamIds?: string[]
    playerIds?: string[]
  }
): Promise<NonBdlEventPhotoItem> {
  const db = getDb()
  const [existing] = await db
    .select()
    .from(nonBdlEventPhotos)
    .where(
      and(
        eq(nonBdlEventPhotos.id, photoId),
        eq(nonBdlEventPhotos.eventId, eventId)
      )
    )
    .limit(1)
  if (!existing) throw new Error('Photo not found')

  const updates: {
    caption?: string | null
    sortOrder?: number
    updatedAt: Date
  } = { updatedAt: new Date() }

  if (patch.caption !== undefined) {
    updates.caption =
      patch.caption == null || patch.caption.trim() === ''
        ? null
        : patch.caption.trim()
  }
  if (patch.sortOrder !== undefined) {
    if (!Number.isFinite(patch.sortOrder)) throw new Error('Invalid sortOrder')
    updates.sortOrder = Math.trunc(patch.sortOrder)
  }

  const [updated] = await db
    .update(nonBdlEventPhotos)
    .set(updates)
    .where(eq(nonBdlEventPhotos.id, photoId))
    .returning()

  let teamIds: string[]
  let playerIds: string[]

  if (patch.teamIds !== undefined || patch.playerIds !== undefined) {
    const currentTeamTags = await db
      .select({ teamId: nonBdlEventPhotoTeamTags.teamId })
      .from(nonBdlEventPhotoTeamTags)
      .where(eq(nonBdlEventPhotoTeamTags.photoId, photoId))
    const currentPlayerTags = await db
      .select({ playerId: nonBdlEventPhotoPlayerTags.playerId })
      .from(nonBdlEventPhotoPlayerTags)
      .where(eq(nonBdlEventPhotoPlayerTags.photoId, photoId))

    teamIds = patch.teamIds ?? currentTeamTags.map((t) => t.teamId)
    playerIds = patch.playerIds ?? currentPlayerTags.map((t) => t.playerId)
    await replacePhotoTags(photoId, eventId, teamIds, playerIds)
  } else {
    const currentTeamTags = await db
      .select({ teamId: nonBdlEventPhotoTeamTags.teamId })
      .from(nonBdlEventPhotoTeamTags)
      .where(eq(nonBdlEventPhotoTeamTags.photoId, photoId))
    const currentPlayerTags = await db
      .select({ playerId: nonBdlEventPhotoPlayerTags.playerId })
      .from(nonBdlEventPhotoPlayerTags)
      .where(eq(nonBdlEventPhotoPlayerTags.photoId, photoId))
    teamIds = currentTeamTags.map((t) => t.teamId)
    playerIds = currentPlayerTags.map((t) => t.playerId)
  }

  return {
    ...updated,
    teamIds,
    playerIds,
  }
}

export async function deleteNonBdlEventPhoto(
  eventId: string,
  photoId: string
): Promise<void> {
  const db = getDb()
  const [existing] = await db
    .select()
    .from(nonBdlEventPhotos)
    .where(
      and(
        eq(nonBdlEventPhotos.id, photoId),
        eq(nonBdlEventPhotos.eventId, eventId)
      )
    )
    .limit(1)
  if (!existing) throw new Error('Photo not found')

  await db
    .delete(nonBdlEventPhotos)
    .where(eq(nonBdlEventPhotos.id, photoId))

  try {
    if (isUnderPhotoPrefix(existing.pathname)) {
      await del(existing.pathname)
    } else if (isVercelBlobHost(new URL(existing.blobUrl).hostname)) {
      await del(existing.blobUrl)
    }
  } catch {
    // Best-effort blob cleanup
  }
}

export { PHOTO_BLOB_PREFIX }
