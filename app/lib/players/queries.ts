import { and, asc, desc, eq, ilike, inArray, isNull, notInArray, or, sql } from 'drizzle-orm'
import { getDb } from '@/app/lib/db'
import {
  eventRegistrations,
  playerAliases,
  playerChanges,
  playerEmails,
  playerHomeLeagues,
  playerMessagingPrefs,
  playerPhones,
  players,
} from '@/app/db/schema'
import {
  resolveJerseyName,
  resolveNickname,
  skillLevelLabel,
} from '@/app/lib/players/skill'
import { genderGroupLabel, genderLabel } from '@/app/lib/players/gender'
import { homeLeagueLabel, homeLeagueLogoUrl, isValidHomeLeague } from '@/app/lib/players/home-league'
import type { PlayerListItem, PlayerSnapshot } from '@/app/lib/players/types'

export type EventMatch = 'registered' | 'not_registered'

export async function listPlayers(opts: {
  q?: string
  skill?: number | 'unset' | null
  homeLeague?: string | 'unset' | null
  /** When set (non-empty), OR-match any of these home leagues (overrides singular homeLeague). */
  homeLeagues?: string[] | null
  eventId?: string | null
  /** Defaults to `registered` when `eventId` is set. */
  eventMatch?: EventMatch
  includeMerged?: boolean
}): Promise<PlayerListItem[]> {
  const db = getDb()
  const conditions = []

  if (!opts.includeMerged) {
    conditions.push(eq(players.isMerged, false))
  }

  if (opts.skill === 'unset') {
    conditions.push(isNull(players.skillLevel))
  } else if (typeof opts.skill === 'number') {
    conditions.push(eq(players.skillLevel, opts.skill))
  }

  const multiHomeLeagues = (opts.homeLeagues ?? []).filter(isValidHomeLeague)
  if (multiHomeLeagues.length > 0) {
    const matchingHomeLeagueIds = db
      .select({ playerId: playerHomeLeagues.playerId })
      .from(playerHomeLeagues)
      .where(inArray(playerHomeLeagues.homeLeague, multiHomeLeagues))
    conditions.push(inArray(players.id, matchingHomeLeagueIds))
  } else if (opts.homeLeague === 'unset') {
    const playersWithHomeLeague = db
      .select({ playerId: playerHomeLeagues.playerId })
      .from(playerHomeLeagues)
    conditions.push(notInArray(players.id, playersWithHomeLeague))
  } else if (opts.homeLeague && isValidHomeLeague(opts.homeLeague)) {
    const matchingHomeLeagueIds = db
      .select({ playerId: playerHomeLeagues.playerId })
      .from(playerHomeLeagues)
      .where(eq(playerHomeLeagues.homeLeague, opts.homeLeague))
    conditions.push(inArray(players.id, matchingHomeLeagueIds))
  }

  if (opts.eventId) {
    const registeredIds = db
      .select({ playerId: eventRegistrations.playerId })
      .from(eventRegistrations)
      .where(eq(eventRegistrations.eventId, opts.eventId))
    if (opts.eventMatch === 'not_registered') {
      conditions.push(notInArray(players.id, registeredIds))
    } else {
      conditions.push(inArray(players.id, registeredIds))
    }
  }

  if (opts.q?.trim()) {
    const term = `%${opts.q.trim()}%`
    const matchingEmailIds = db
      .select({ playerId: playerEmails.playerId })
      .from(playerEmails)
      .where(ilike(playerEmails.email, term))
    const matchingAliasIds = db
      .select({ playerId: playerAliases.playerId })
      .from(playerAliases)
      .where(ilike(playerAliases.alias, term))

    conditions.push(
      or(
        ilike(players.firstName, term),
        ilike(players.lastName, term),
        ilike(players.rosterName, term),
        ilike(players.nickname, term),
        ilike(players.jerseyName, term),
        inArray(players.id, matchingEmailIds),
        inArray(players.id, matchingAliasIds)
      )
    )
  }

  const rows = await db
    .select()
    .from(players)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(players.lastName), asc(players.firstName))

  if (rows.length === 0) return []

  const ids = rows.map((r) => r.id)
  const emails = await db
    .select()
    .from(playerEmails)
    .where(inArray(playerEmails.playerId, ids))

  const phones = await db
    .select()
    .from(playerPhones)
    .where(inArray(playerPhones.playerId, ids))

  const homeLeagueRows = await db
    .select()
    .from(playerHomeLeagues)
    .where(inArray(playerHomeLeagues.playerId, ids))
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

  const primaryPhoneByPlayer = new Map<string, string>()
  for (const p of phones) {
    if (p.isPrimary && !primaryPhoneByPlayer.has(p.playerId)) {
      primaryPhoneByPlayer.set(p.playerId, p.phoneE164)
    }
  }
  for (const p of phones) {
    if (!primaryPhoneByPlayer.has(p.playerId)) {
      primaryPhoneByPlayer.set(p.playerId, p.phoneE164)
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

  return rows.map((r) => ({
    id: r.id,
    firstName: r.firstName,
    lastName: r.lastName,
    rosterName: r.rosterName,
    nickname: resolveNickname(r.nickname, r.firstName, r.lastName),
    jerseyNumber: r.jerseyNumber,
    jerseyName: resolveJerseyName(r.jerseyName, r.lastName),
    skillLevel: r.skillLevel,
    skillLevelFib: r.skillLevelFib,
    skillAreas: r.skillAreas ?? null,
    skillLabel: skillLevelLabel(r.skillLevel),
    gender: r.gender,
    genderLabel: genderLabel(r.gender),
    genderGroupLabel: genderGroupLabel(r.gender),
    photoUrl: r.photoUrl ?? null,
    primaryEmail: primaryByPlayer.get(r.id) ?? null,
    primaryPhone: primaryPhoneByPlayer.get(r.id) ?? null,
    isMerged: r.isMerged,
    hasStrongPersonality: r.hasStrongPersonality,
    strongPersonalityNotes: r.strongPersonalityNotes,
    homeLeagues: homeLeaguesByPlayer.get(r.id) ?? [],
  }))
}

export async function getPlayerSnapshot(playerId: string): Promise<PlayerSnapshot | null> {
  const db = getDb()
  const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1)
  if (!player) return null

  const emails = await db
    .select()
    .from(playerEmails)
    .where(eq(playerEmails.playerId, playerId))
    .orderBy(desc(playerEmails.isPrimary), asc(playerEmails.email))

  const phones = await db
    .select()
    .from(playerPhones)
    .where(eq(playerPhones.playerId, playerId))
    .orderBy(desc(playerPhones.isPrimary), asc(playerPhones.phoneE164))

  const [prefs] = await db
    .select()
    .from(playerMessagingPrefs)
    .where(eq(playerMessagingPrefs.playerId, playerId))
    .limit(1)

  const aliases = await db
    .select()
    .from(playerAliases)
    .where(eq(playerAliases.playerId, playerId))
    .orderBy(asc(playerAliases.alias))

  const homeLeagues = await db
    .select()
    .from(playerHomeLeagues)
    .where(eq(playerHomeLeagues.playerId, playerId))
    .orderBy(asc(playerHomeLeagues.sortOrder))

  const nicknameCustom = player.nickname?.trim() ? player.nickname.trim() : null
  const jerseyNameCustom = player.jerseyName?.trim() ? player.jerseyName.trim() : null

  return {
    id: player.id,
    firstName: player.firstName,
    lastName: player.lastName,
    rosterName: player.rosterName,
    nickname: resolveNickname(nicknameCustom, player.firstName, player.lastName),
    nicknameCustom,
    jerseyNumber: player.jerseyNumber,
    jerseyName: resolveJerseyName(jerseyNameCustom, player.lastName),
    jerseyNameCustom,
    skillLevel: player.skillLevel,
    skillLevelFib: player.skillLevelFib,
    skillAreas: player.skillAreas ?? null,
    gender: player.gender,
    photoUrl: player.photoUrl ?? null,
    photoPathname: player.photoPathname ?? null,
    isMerged: player.isMerged,
    mergedIntoPlayerId: player.mergedIntoPlayerId,
    hasStrongPersonality: player.hasStrongPersonality,
    strongPersonalityNotes: player.strongPersonalityNotes,
    emails: emails.map((e) => ({ id: e.id, email: e.email, isPrimary: e.isPrimary })),
    phones: phones.map((p) => ({
      id: p.id,
      phoneE164: p.phoneE164,
      isPrimary: p.isPrimary,
    })),
    aliases: aliases.map((a) => ({ id: a.id, alias: a.alias })),
    homeLeagues: homeLeagues.map((h) => ({
      id: h.id,
      homeLeague: h.homeLeague,
      label: homeLeagueLabel(h.homeLeague),
      logoUrl: homeLeagueLogoUrl(h.homeLeague),
      sortOrder: h.sortOrder,
    })),
    messagingPrefs: prefs
      ? {
          emailOptOutAt: prefs.emailOptOutAt?.toISOString() ?? null,
          smsOptInAt: prefs.smsOptInAt?.toISOString() ?? null,
          smsOptOutAt: prefs.smsOptOutAt?.toISOString() ?? null,
          whatsappOptInAt: prefs.whatsappOptInAt?.toISOString() ?? null,
          whatsappOptOutAt: prefs.whatsappOptOutAt?.toISOString() ?? null,
        }
      : null,
  }
}

export function snapshotToJson(snapshot: PlayerSnapshot): Record<string, unknown> {
  return {
    id: snapshot.id,
    firstName: snapshot.firstName,
    lastName: snapshot.lastName,
    rosterName: snapshot.rosterName,
    nickname: snapshot.nickname,
    nicknameCustom: snapshot.nicknameCustom,
    jerseyNumber: snapshot.jerseyNumber,
    jerseyName: snapshot.jerseyName,
    jerseyNameCustom: snapshot.jerseyNameCustom,
    skillLevel: snapshot.skillLevel,
    skillLevelFib: snapshot.skillLevelFib,
    skillAreas: snapshot.skillAreas,
    gender: snapshot.gender,
    photoUrl: snapshot.photoUrl,
    photoPathname: snapshot.photoPathname,
    isMerged: snapshot.isMerged,
    mergedIntoPlayerId: snapshot.mergedIntoPlayerId,
    hasStrongPersonality: snapshot.hasStrongPersonality,
    strongPersonalityNotes: snapshot.strongPersonalityNotes,
    emails: snapshot.emails,
    phones: snapshot.phones,
    aliases: snapshot.aliases,
    homeLeagues: snapshot.homeLeagues,
    messagingPrefs: snapshot.messagingPrefs,
  }
}

export async function getPlayerHistory(playerId: string) {
  const db = getDb()
  return db
    .select()
    .from(playerChanges)
    .where(eq(playerChanges.playerId, playerId))
    .orderBy(desc(playerChanges.createdAt))
}

/** Find player id by email (any). */
export async function findPlayerIdByEmail(email: string): Promise<string | null> {
  const db = getDb()
  const [row] = await db
    .select({ playerId: playerEmails.playerId })
    .from(playerEmails)
    .where(eq(playerEmails.email, email))
    .limit(1)
  return row?.playerId ?? null
}

/** Find non-merged players matching first+last (case-insensitive). */
export async function findPlayerIdsByName(
  firstName: string,
  lastName: string
): Promise<string[]> {
  const db = getDb()
  const rows = await db
    .select({ id: players.id })
    .from(players)
    .where(
      and(
        eq(players.isMerged, false),
        sql`lower(${players.firstName}) = ${firstName.toLowerCase()}`,
        sql`lower(${players.lastName}) = ${lastName.toLowerCase()}`
      )
    )
  return rows.map((r) => r.id)
}
