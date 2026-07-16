import { asc, count, desc, eq, inArray, sql } from 'drizzle-orm'
import { getDb } from '@/app/lib/db'
import {
  eventRegistrations,
  events,
  playerEmails,
  players,
} from '@/app/db/schema'
import {
  eventTypeLabel,
  type EventListItem,
  type EventRecord,
  type EventRegistrationListItem,
} from '@/app/lib/events/types'
import {
  resolveNickname,
  skillLevelLabel,
} from '@/app/lib/players/skill'
import { genderGroupLabel, genderLabel } from '@/app/lib/players/gender'

export async function listEvents(): Promise<EventListItem[]> {
  const db = getDb()
  const rows = await db
    .select({
      id: events.id,
      name: events.name,
      eventDate: events.eventDate,
      eventType: events.eventType,
      notes: events.notes,
      registrationCount: count(eventRegistrations.id),
    })
    .from(events)
    .leftJoin(eventRegistrations, eq(eventRegistrations.eventId, events.id))
    .groupBy(events.id)
    .orderBy(desc(events.eventDate), asc(events.name))

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    eventDate: r.eventDate,
    eventType: r.eventType,
    eventTypeLabel: eventTypeLabel(r.eventType),
    notes: r.notes,
    registrationCount: Number(r.registrationCount),
  }))
}

export async function getEvent(id: string): Promise<EventRecord | null> {
  const db = getDb()
  const [row] = await db.select().from(events).where(eq(events.id, id)).limit(1)
  return row ?? null
}

export async function listEventRegistrations(
  eventId: string
): Promise<EventRegistrationListItem[]> {
  const db = getDb()
  const rows = await db
    .select({
      id: eventRegistrations.id,
      eventId: eventRegistrations.eventId,
      playerId: eventRegistrations.playerId,
      status: eventRegistrations.status,
      draftGroup: eventRegistrations.draftGroup,
      registeredAt: eventRegistrations.registeredAt,
      updatedAt: eventRegistrations.updatedAt,
      firstName: players.firstName,
      lastName: players.lastName,
      rosterName: players.rosterName,
      nickname: players.nickname,
      jerseyNumber: players.jerseyNumber,
      skillLevel: players.skillLevel,
      gender: players.gender,
    })
    .from(eventRegistrations)
    .innerJoin(players, eq(players.id, eventRegistrations.playerId))
    .where(eq(eventRegistrations.eventId, eventId))
    .orderBy(
      sql`CASE WHEN ${eventRegistrations.draftGroup} IS NULL THEN 1 ELSE 0 END`,
      asc(eventRegistrations.draftGroup),
      sql`CASE WHEN ${players.skillLevel} IS NULL THEN 1 ELSE 0 END`,
      desc(players.skillLevel),
      asc(players.lastName),
      asc(players.firstName)
    )

  if (rows.length === 0) return []

  const playerIds = rows.map((r) => r.playerId)
  const emails = await db
    .select()
    .from(playerEmails)
    .where(inArray(playerEmails.playerId, playerIds))

  const primaryByPlayer = new Map<string, string>()
  for (const e of emails) {
    if (e.isPrimary && !primaryByPlayer.has(e.playerId)) {
      primaryByPlayer.set(e.playerId, e.email)
    }
  }
  for (const e of emails) {
    if (!primaryByPlayer.has(e.playerId)) {
      primaryByPlayer.set(e.playerId, e.email)
    }
  }

  return rows.map((r) => ({
    id: r.id,
    eventId: r.eventId,
    playerId: r.playerId,
    status: r.status,
    draftGroup: r.draftGroup,
    registeredAt: r.registeredAt,
    updatedAt: r.updatedAt,
    firstName: r.firstName,
    lastName: r.lastName,
    rosterName: r.rosterName,
    nickname: resolveNickname(r.nickname, r.firstName, r.lastName),
    jerseyNumber: r.jerseyNumber,
    skillLevel: r.skillLevel,
    skillLabel: skillLevelLabel(r.skillLevel),
    gender: r.gender,
    genderLabel: genderLabel(r.gender),
    genderGroupLabel: genderGroupLabel(r.gender),
    primaryEmail: primaryByPlayer.get(r.playerId) ?? null,
  }))
}

export async function getRegisteredPlayerIds(eventId: string): Promise<Set<string>> {
  const db = getDb()
  const rows = await db
    .select({ playerId: eventRegistrations.playerId })
    .from(eventRegistrations)
    .where(eq(eventRegistrations.eventId, eventId))
  return new Set(rows.map((r) => r.playerId))
}
