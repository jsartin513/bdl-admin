import { and, asc, count, desc, eq, inArray, sql } from 'drizzle-orm'
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
import { resolveNickname } from '@/app/lib/players/skill'
import {
  ballTypeLabel,
  hostOrgDisplayLabel,
  type NonBdlEventAttendeeItem,
  type NonBdlEventDetail,
  type NonBdlEventListItem,
  type NonBdlEventPhotoItem,
  type NonBdlEventRecord,
  type NonBdlEventStoryItem,
  type NonBdlEventTeamItem,
} from '@/app/lib/non-bdl-events/types'

export async function listNonBdlEvents(): Promise<NonBdlEventListItem[]> {
  const db = getDb()
  const rows = await db
    .select({
      id: nonBdlEvents.id,
      name: nonBdlEvents.name,
      eventDate: nonBdlEvents.eventDate,
      ballType: nonBdlEvents.ballType,
      division: nonBdlEvents.division,
      city: nonBdlEvents.city,
      hostOrgHomeLeague: nonBdlEvents.hostOrgHomeLeague,
      hostOrgName: nonBdlEvents.hostOrgName,
      attendeeCount: count(nonBdlEventAttendees.id),
    })
    .from(nonBdlEvents)
    .leftJoin(
      nonBdlEventAttendees,
      eq(nonBdlEventAttendees.eventId, nonBdlEvents.id)
    )
    .groupBy(
      nonBdlEvents.id,
      nonBdlEvents.name,
      nonBdlEvents.eventDate,
      nonBdlEvents.ballType,
      nonBdlEvents.division,
      nonBdlEvents.city,
      nonBdlEvents.hostOrgHomeLeague,
      nonBdlEvents.hostOrgName
    )
    .orderBy(desc(nonBdlEvents.eventDate), asc(nonBdlEvents.name))

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    eventDate: row.eventDate,
    ballType: row.ballType,
    ballTypeLabel: ballTypeLabel(row.ballType),
    division: row.division,
    city: row.city,
    hostOrgLabel: hostOrgDisplayLabel(row.hostOrgHomeLeague, row.hostOrgName),
    attendeeCount: Number(row.attendeeCount),
  }))
}

export async function getNonBdlEvent(
  id: string
): Promise<NonBdlEventRecord | null> {
  const db = getDb()
  const [row] = await db
    .select()
    .from(nonBdlEvents)
    .where(eq(nonBdlEvents.id, id))
    .limit(1)
  return row ?? null
}

export async function listNonBdlEventTeams(
  eventId: string
): Promise<NonBdlEventTeamItem[]> {
  const db = getDb()
  return db
    .select()
    .from(nonBdlEventTeams)
    .where(eq(nonBdlEventTeams.eventId, eventId))
    .orderBy(asc(nonBdlEventTeams.name))
}

export async function listNonBdlEventAttendees(
  eventId: string
): Promise<NonBdlEventAttendeeItem[]> {
  const db = getDb()
  const rows = await db
    .select({
      id: nonBdlEventAttendees.id,
      eventId: nonBdlEventAttendees.eventId,
      playerId: nonBdlEventAttendees.playerId,
      teamId: nonBdlEventAttendees.teamId,
      notes: nonBdlEventAttendees.notes,
      createdAt: nonBdlEventAttendees.createdAt,
      updatedAt: nonBdlEventAttendees.updatedAt,
      firstName: players.firstName,
      lastName: players.lastName,
      rosterName: players.rosterName,
      nickname: players.nickname,
      teamName: nonBdlEventTeams.name,
    })
    .from(nonBdlEventAttendees)
    .innerJoin(players, eq(players.id, nonBdlEventAttendees.playerId))
    .leftJoin(nonBdlEventTeams, eq(nonBdlEventTeams.id, nonBdlEventAttendees.teamId))
    .where(eq(nonBdlEventAttendees.eventId, eventId))
    .orderBy(
      sql`CASE WHEN ${nonBdlEventTeams.name} IS NULL THEN 1 ELSE 0 END`,
      asc(nonBdlEventTeams.name),
      asc(players.lastName),
      asc(players.firstName)
    )

  return rows.map((row) => ({
    id: row.id,
    eventId: row.eventId,
    playerId: row.playerId,
    teamId: row.teamId,
    teamName: row.teamName,
    notes: row.notes,
    firstName: row.firstName,
    lastName: row.lastName,
    rosterName: row.rosterName,
    nickname: resolveNickname(row.nickname, row.firstName, row.lastName),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }))
}

async function listStoriesWithTags(
  eventId: string
): Promise<NonBdlEventStoryItem[]> {
  const db = getDb()
  const stories = await db
    .select()
    .from(nonBdlEventStories)
    .where(eq(nonBdlEventStories.eventId, eventId))
    .orderBy(asc(nonBdlEventStories.sortOrder), asc(nonBdlEventStories.createdAt))

  if (stories.length === 0) return []

  const storyIds = stories.map((s) => s.id)
  const [teamTags, playerTags] = await Promise.all([
    db
      .select()
      .from(nonBdlEventStoryTeamTags)
      .where(inArray(nonBdlEventStoryTeamTags.storyId, storyIds)),
    db
      .select()
      .from(nonBdlEventStoryPlayerTags)
      .where(inArray(nonBdlEventStoryPlayerTags.storyId, storyIds)),
  ])

  const teamsByStory = new Map<string, string[]>()
  for (const tag of teamTags) {
    const list = teamsByStory.get(tag.storyId) ?? []
    list.push(tag.teamId)
    teamsByStory.set(tag.storyId, list)
  }
  const playersByStory = new Map<string, string[]>()
  for (const tag of playerTags) {
    const list = playersByStory.get(tag.storyId) ?? []
    list.push(tag.playerId)
    playersByStory.set(tag.storyId, list)
  }

  return stories.map((s) => ({
    id: s.id,
    eventId: s.eventId,
    title: s.title,
    body: s.body,
    sortOrder: s.sortOrder,
    teamIds: teamsByStory.get(s.id) ?? [],
    playerIds: playersByStory.get(s.id) ?? [],
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }))
}

async function listPhotosWithTags(
  eventId: string
): Promise<NonBdlEventPhotoItem[]> {
  const db = getDb()
  const photos = await db
    .select()
    .from(nonBdlEventPhotos)
    .where(eq(nonBdlEventPhotos.eventId, eventId))
    .orderBy(asc(nonBdlEventPhotos.sortOrder), asc(nonBdlEventPhotos.createdAt))

  if (photos.length === 0) return []

  const photoIds = photos.map((p) => p.id)
  const [teamTags, playerTags] = await Promise.all([
    db
      .select()
      .from(nonBdlEventPhotoTeamTags)
      .where(inArray(nonBdlEventPhotoTeamTags.photoId, photoIds)),
    db
      .select()
      .from(nonBdlEventPhotoPlayerTags)
      .where(inArray(nonBdlEventPhotoPlayerTags.photoId, photoIds)),
  ])

  const teamsByPhoto = new Map<string, string[]>()
  for (const tag of teamTags) {
    const list = teamsByPhoto.get(tag.photoId) ?? []
    list.push(tag.teamId)
    teamsByPhoto.set(tag.photoId, list)
  }
  const playersByPhoto = new Map<string, string[]>()
  for (const tag of playerTags) {
    const list = playersByPhoto.get(tag.photoId) ?? []
    list.push(tag.playerId)
    playersByPhoto.set(tag.photoId, list)
  }

  return photos.map((p) => ({
    id: p.id,
    eventId: p.eventId,
    blobUrl: p.blobUrl,
    pathname: p.pathname,
    caption: p.caption,
    sortOrder: p.sortOrder,
    teamIds: teamsByPhoto.get(p.id) ?? [],
    playerIds: playersByPhoto.get(p.id) ?? [],
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }))
}

export async function getNonBdlEventDetail(
  id: string
): Promise<NonBdlEventDetail | null> {
  const event = await getNonBdlEvent(id)
  if (!event) return null

  const [teams, attendees, stories, photos] = await Promise.all([
    listNonBdlEventTeams(id),
    listNonBdlEventAttendees(id),
    listStoriesWithTags(id),
    listPhotosWithTags(id),
  ])

  return {
    event: {
      ...event,
      ballTypeLabel: ballTypeLabel(event.ballType),
      hostOrgLabel: hostOrgDisplayLabel(
        event.hostOrgHomeLeague,
        event.hostOrgName
      ),
    },
    teams,
    attendees,
    stories,
    photos,
  }
}

export async function getAttendeePlayerIds(eventId: string): Promise<Set<string>> {
  const db = getDb()
  const rows = await db
    .select({ playerId: nonBdlEventAttendees.playerId })
    .from(nonBdlEventAttendees)
    .where(eq(nonBdlEventAttendees.eventId, eventId))
  return new Set(rows.map((r) => r.playerId))
}

export async function assertTeamBelongsToEvent(
  eventId: string,
  teamId: string
): Promise<void> {
  const db = getDb()
  const [row] = await db
    .select({ id: nonBdlEventTeams.id })
    .from(nonBdlEventTeams)
    .where(
      and(eq(nonBdlEventTeams.id, teamId), eq(nonBdlEventTeams.eventId, eventId))
    )
    .limit(1)
  if (!row) throw new Error('Team not found for this event')
}

export async function assertTeamsBelongToEvent(
  eventId: string,
  teamIds: string[]
): Promise<void> {
  if (teamIds.length === 0) return
  const unique = [...new Set(teamIds)]
  const db = getDb()
  const rows = await db
    .select({ id: nonBdlEventTeams.id })
    .from(nonBdlEventTeams)
    .where(
      and(
        eq(nonBdlEventTeams.eventId, eventId),
        inArray(nonBdlEventTeams.id, unique)
      )
    )
  if (rows.length !== unique.length) {
    throw new Error('One or more teams are not part of this event')
  }
}

export async function assertPlayersAttendEvent(
  eventId: string,
  playerIds: string[]
): Promise<void> {
  if (playerIds.length === 0) return
  const unique = [...new Set(playerIds)]
  const attending = await getAttendeePlayerIds(eventId)
  for (const id of unique) {
    if (!attending.has(id)) {
      throw new Error('One or more players are not attendees of this event')
    }
  }
}
