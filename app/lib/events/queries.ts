import { asc, count, desc, eq, inArray, sql } from 'drizzle-orm'
import { getDb } from '@/app/lib/db'
import {
  eventRegistrations,
  events,
  playerEmails,
  playerHomeLeagues,
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
import {
  homeLeagueLabel,
  homeLeagueLogoUrl,
} from '@/app/lib/players/home-league'

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
      isCaptain: eventRegistrations.isCaptain,
      pairId: eventRegistrations.pairId,
      registeredAt: eventRegistrations.registeredAt,
      updatedAt: eventRegistrations.updatedAt,
      firstName: players.firstName,
      lastName: players.lastName,
      rosterName: players.rosterName,
      nickname: players.nickname,
      jerseyNumber: players.jerseyNumber,
      skillLevel: players.skillLevel,
      gender: players.gender,
      hasStrongPersonality: players.hasStrongPersonality,
      strongPersonalityNotes: players.strongPersonalityNotes,
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

  const homeLeagueRows = await db
    .select()
    .from(playerHomeLeagues)
    .where(inArray(playerHomeLeagues.playerId, playerIds))
    .orderBy(asc(playerHomeLeagues.sortOrder))

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

  const homeLeaguesByPlayer = new Map<
    string,
    { homeLeague: string; label: string; logoUrl: string | null }[]
  >()
  for (const row of homeLeagueRows) {
    const list = homeLeaguesByPlayer.get(row.playerId) ?? []
    list.push({
      homeLeague: row.homeLeague,
      label: homeLeagueLabel(row.homeLeague),
      logoUrl: homeLeagueLogoUrl(row.homeLeague),
    })
    homeLeaguesByPlayer.set(row.playerId, list)
  }

  const nicknameById = new Map(
    rows.map((r) => [
      r.id,
      resolveNickname(r.nickname, r.firstName, r.lastName),
    ])
  )
  const partnerByRegistrationId = new Map<string, string>()
  const byPairId = new Map<string, string[]>()
  for (const r of rows) {
    if (!r.pairId) continue
    const list = byPairId.get(r.pairId) ?? []
    list.push(r.id)
    byPairId.set(r.pairId, list)
  }
  for (const members of byPairId.values()) {
    if (members.length !== 2) continue
    partnerByRegistrationId.set(members[0], members[1])
    partnerByRegistrationId.set(members[1], members[0])
  }

  return rows.map((r) => {
    const partnerRegistrationId = partnerByRegistrationId.get(r.id) ?? null
    return {
      id: r.id,
      eventId: r.eventId,
      playerId: r.playerId,
      status: r.status,
      draftGroup: r.draftGroup,
      isCaptain: r.isCaptain,
      pairId: r.pairId,
      partnerRegistrationId,
      partnerNickname: partnerRegistrationId
        ? (nicknameById.get(partnerRegistrationId) ?? null)
        : null,
      registeredAt: r.registeredAt,
      updatedAt: r.updatedAt,
      firstName: r.firstName,
      lastName: r.lastName,
      rosterName: r.rosterName,
      nickname: nicknameById.get(r.id)!,
      jerseyNumber: r.jerseyNumber,
      skillLevel: r.skillLevel,
      skillLabel: skillLevelLabel(r.skillLevel),
      gender: r.gender,
      genderLabel: genderLabel(r.gender),
      genderGroupLabel: genderGroupLabel(r.gender),
      primaryEmail: primaryByPlayer.get(r.playerId) ?? null,
      hasStrongPersonality: r.hasStrongPersonality,
      strongPersonalityNotes: r.strongPersonalityNotes,
      homeLeagues: homeLeaguesByPlayer.get(r.playerId) ?? [],
    }
  })
}

export async function getRegisteredPlayerIds(eventId: string): Promise<Set<string>> {
  const db = getDb()
  const rows = await db
    .select({ playerId: eventRegistrations.playerId })
    .from(eventRegistrations)
    .where(eq(eventRegistrations.eventId, eventId))
  return new Set(rows.map((r) => r.playerId))
}
