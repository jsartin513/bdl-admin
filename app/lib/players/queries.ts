import { and, asc, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm'
import { getDb } from '@/app/lib/db'
import {
  playerAliases,
  playerChanges,
  playerEmails,
  playerHomeLeagues,
  players,
} from '@/app/db/schema'
import {
  resolveJerseyName,
  resolveNickname,
  skillLevelLabel,
} from '@/app/lib/players/skill'
import { genderGroupLabel, genderLabel } from '@/app/lib/players/gender'
import { homeLeagueLabel, isValidHomeLeague } from '@/app/lib/players/home-league'
import type { PlayerListItem, PlayerSnapshot } from '@/app/lib/players/types'

export async function listPlayers(opts: {
  q?: string
  skill?: number | 'unset' | null
  homeLeague?: string | null
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

  if (opts.homeLeague && isValidHomeLeague(opts.homeLeague)) {
    const matchingHomeLeagueIds = db
      .select({ playerId: playerHomeLeagues.playerId })
      .from(playerHomeLeagues)
      .where(eq(playerHomeLeagues.homeLeague, opts.homeLeague))
    conditions.push(inArray(players.id, matchingHomeLeagueIds))
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

  const homeLeaguesByPlayer = new Map<string, { homeLeague: string; label: string }[]>()
  for (const row of homeLeagueRows) {
    const list = homeLeaguesByPlayer.get(row.playerId) ?? []
    list.push({
      homeLeague: row.homeLeague,
      label: homeLeagueLabel(row.homeLeague),
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
    skillLabel: skillLevelLabel(r.skillLevel),
    gender: r.gender,
    genderLabel: genderLabel(r.gender),
    genderGroupLabel: genderGroupLabel(r.gender),
    primaryEmail: primaryByPlayer.get(r.id) ?? null,
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
    gender: player.gender,
    isMerged: player.isMerged,
    mergedIntoPlayerId: player.mergedIntoPlayerId,
    hasStrongPersonality: player.hasStrongPersonality,
    strongPersonalityNotes: player.strongPersonalityNotes,
    emails: emails.map((e) => ({ id: e.id, email: e.email, isPrimary: e.isPrimary })),
    aliases: aliases.map((a) => ({ id: a.id, alias: a.alias })),
    homeLeagues: homeLeagues.map((h) => ({
      id: h.id,
      homeLeague: h.homeLeague,
      label: homeLeagueLabel(h.homeLeague),
      sortOrder: h.sortOrder,
    })),
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
    gender: snapshot.gender,
    isMerged: snapshot.isMerged,
    mergedIntoPlayerId: snapshot.mergedIntoPlayerId,
    hasStrongPersonality: snapshot.hasStrongPersonality,
    strongPersonalityNotes: snapshot.strongPersonalityNotes,
    emails: snapshot.emails,
    aliases: snapshot.aliases,
    homeLeagues: snapshot.homeLeagues,
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
