import { and, asc, eq, max } from 'drizzle-orm'
import { getDb } from '@/app/lib/db'
import { playerAliases, playerEmails, playerHomeLeagues, players } from '@/app/db/schema'
import { writePlayerChange } from '@/app/lib/players/audit'
import {
  bulkPatchHasCoreFields,
  type BulkPlayerPatch,
} from '@/app/lib/players/bulk'
import {
  defaultRosterName,
  isValidSkillLevel,
  normalizeStoredJerseyName,
  normalizeStoredNickname,
} from '@/app/lib/players/skill'
import { isValidGender } from '@/app/lib/players/gender'
import { isValidHomeLeague } from '@/app/lib/players/home-league'
import {
  getPlayerSnapshot,
  snapshotToJson,
} from '@/app/lib/players/queries'
import { normalizeAlias, normalizeEmail, normalizeNamePart } from '@/app/lib/players/normalize'
import type { ChangeSource, PlayerSnapshot } from '@/app/lib/players/types'

export async function createPlayer(input: {
  firstName: string
  lastName: string
  rosterName?: string
  nickname?: string | null
  jerseyNumber?: number | null
  jerseyName?: string | null
  skillLevel?: number | null
  gender?: string | null
  email?: string | null
  actor: string
  source?: ChangeSource
  importBatchId?: string | null
}) {
  const db = getDb()
  const firstName = normalizeNamePart(input.firstName)
  const lastName = normalizeNamePart(input.lastName)
  if (!firstName || !lastName) {
    throw new Error('First and last name are required')
  }

  const rosterName = input.rosterName?.trim()
    ? normalizeNamePart(input.rosterName)
    : defaultRosterName(firstName, lastName)
  const nickname =
    input.nickname !== undefined
      ? normalizeStoredNickname(input.nickname, firstName, lastName)
      : null
  const jerseyName =
    input.jerseyName !== undefined
      ? normalizeStoredJerseyName(input.jerseyName, lastName)
      : null

  let skillLevel: number | null = null
  if (input.skillLevel != null) {
    if (!isValidSkillLevel(input.skillLevel)) throw new Error('Invalid skill level')
    skillLevel = input.skillLevel
  }

  let gender: string | null = null
  if (input.gender != null) {
    if (!isValidGender(input.gender)) throw new Error('Invalid gender')
    gender = input.gender
  }

  const [created] = await db
    .insert(players)
    .values({
      firstName,
      lastName,
      rosterName,
      nickname,
      jerseyNumber: input.jerseyNumber ?? null,
      jerseyName,
      skillLevel,
      gender,
    })
    .returning()

  if (input.email?.trim()) {
    const email = normalizeEmail(input.email)
    await db.insert(playerEmails).values({
      playerId: created.id,
      email,
      isPrimary: true,
    })
  }

  const snapshot = await getPlayerSnapshot(created.id)
  await writePlayerChange({
    playerId: created.id,
    source: input.source ?? 'admin',
    actor: input.actor,
    changeType: input.source === 'import' ? 'import' : 'create',
    before: null,
    after: snapshot ? snapshotToJson(snapshot) : null,
    importBatchId: input.importBatchId,
  })

  return snapshot
}

export async function updatePlayer(
  playerId: string,
  patch: {
    firstName?: string
    lastName?: string
    rosterName?: string
    nickname?: string | null
    jerseyNumber?: number | null
    jerseyName?: string | null
    skillLevel?: number | null
    gender?: string | null
    hasStrongPersonality?: boolean
    strongPersonalityNotes?: string | null
  },
  opts: { actor: string; source?: ChangeSource; importBatchId?: string | null }
) {
  const before = await getPlayerSnapshot(playerId)
  if (!before) throw new Error('Player not found')
  if (before.isMerged) throw new Error('Cannot edit a merged player')

  const db = getDb()
  const updates: Partial<typeof players.$inferInsert> = {
    updatedAt: new Date(),
  }

  if (patch.firstName !== undefined) {
    const v = normalizeNamePart(patch.firstName)
    if (!v) throw new Error('First name is required')
    updates.firstName = v
  }
  if (patch.lastName !== undefined) {
    const v = normalizeNamePart(patch.lastName)
    if (!v) throw new Error('Last name is required')
    updates.lastName = v
  }
  if (patch.rosterName !== undefined) {
    const v = normalizeNamePart(patch.rosterName)
    if (!v) throw new Error('Roster name is required')
    updates.rosterName = v
  }
  if (patch.jerseyNumber !== undefined) {
    updates.jerseyNumber = patch.jerseyNumber
  }
  if (patch.skillLevel !== undefined) {
    if (patch.skillLevel !== null && !isValidSkillLevel(patch.skillLevel)) {
      throw new Error('Invalid skill level')
    }
    updates.skillLevel = patch.skillLevel
  }
  if (patch.gender !== undefined) {
    if (patch.gender !== null && !isValidGender(patch.gender)) {
      throw new Error('Invalid gender')
    }
    updates.gender = patch.gender
  }

  const nextFirst = updates.firstName ?? before.firstName
  const nextLast = updates.lastName ?? before.lastName
  if (patch.nickname !== undefined) {
    updates.nickname = normalizeStoredNickname(patch.nickname, nextFirst, nextLast)
  }
  if (patch.jerseyName !== undefined) {
    updates.jerseyName = normalizeStoredJerseyName(patch.jerseyName, nextLast)
  }
  if (patch.hasStrongPersonality !== undefined) {
    updates.hasStrongPersonality = patch.hasStrongPersonality
  }
  if (patch.strongPersonalityNotes !== undefined) {
    updates.strongPersonalityNotes =
      patch.strongPersonalityNotes != null ? patch.strongPersonalityNotes.trim() || null : null
  }

  await db.update(players).set(updates).where(eq(players.id, playerId))

  const after = await getPlayerSnapshot(playerId)
  await writePlayerChange({
    playerId,
    source: opts.source ?? 'admin',
    actor: opts.actor,
    changeType: opts.source === 'import' ? 'import' : 'update',
    before: snapshotToJson(before),
    after: after ? snapshotToJson(after) : null,
    importBatchId: opts.importBatchId,
  })

  return after
}

export async function addPlayerEmail(
  playerId: string,
  emailRaw: string,
  opts: { actor: string; makePrimary?: boolean }
) {
  const before = await getPlayerSnapshot(playerId)
  if (!before) throw new Error('Player not found')
  if (before.isMerged) throw new Error('Cannot edit a merged player')

  const email = normalizeEmail(emailRaw)
  if (!email || !email.includes('@')) throw new Error('Invalid email')

  const db = getDb()
  const existing = await findEmailOwner(email)
  if (existing && existing !== playerId) {
    throw new Error('Email already belongs to another player')
  }
  if (before.emails.some((e) => e.email === email)) {
    throw new Error('Email already on this player')
  }

  const makePrimary = opts.makePrimary ?? before.emails.length === 0
  if (makePrimary) {
    await db
      .update(playerEmails)
      .set({ isPrimary: false })
      .where(eq(playerEmails.playerId, playerId))
  }

  await db.insert(playerEmails).values({
    playerId,
    email,
    isPrimary: makePrimary,
  })

  const after = await getPlayerSnapshot(playerId)
  await writePlayerChange({
    playerId,
    source: 'admin',
    actor: opts.actor,
    changeType: 'update',
    before: snapshotToJson(before),
    after: after ? snapshotToJson(after) : null,
  })
  return after
}

export async function removePlayerEmail(
  playerId: string,
  emailId: string,
  opts: { actor: string }
) {
  const before = await getPlayerSnapshot(playerId)
  if (!before) throw new Error('Player not found')
  if (before.isMerged) throw new Error('Cannot edit a merged player')

  const db = getDb()
  await db
    .delete(playerEmails)
    .where(and(eq(playerEmails.id, emailId), eq(playerEmails.playerId, playerId)))

  const remaining = await getPlayerSnapshot(playerId)
  if (remaining && remaining.emails.length > 0 && !remaining.emails.some((e) => e.isPrimary)) {
    await db
      .update(playerEmails)
      .set({ isPrimary: true })
      .where(eq(playerEmails.id, remaining.emails[0].id))
  }

  const after = await getPlayerSnapshot(playerId)
  await writePlayerChange({
    playerId,
    source: 'admin',
    actor: opts.actor,
    changeType: 'update',
    before: snapshotToJson(before),
    after: after ? snapshotToJson(after) : null,
  })
  return after
}

export async function setPrimaryEmail(
  playerId: string,
  emailId: string,
  opts: { actor: string }
) {
  const before = await getPlayerSnapshot(playerId)
  if (!before) throw new Error('Player not found')
  if (before.isMerged) throw new Error('Cannot edit a merged player')

  const db = getDb()
  await db
    .update(playerEmails)
    .set({ isPrimary: false })
    .where(eq(playerEmails.playerId, playerId))
  await db
    .update(playerEmails)
    .set({ isPrimary: true })
    .where(and(eq(playerEmails.id, emailId), eq(playerEmails.playerId, playerId)))

  const after = await getPlayerSnapshot(playerId)
  await writePlayerChange({
    playerId,
    source: 'admin',
    actor: opts.actor,
    changeType: 'update',
    before: snapshotToJson(before),
    after: after ? snapshotToJson(after) : null,
  })
  return after
}

export async function addPlayerAlias(
  playerId: string,
  aliasRaw: string,
  opts: { actor: string; source?: ChangeSource; importBatchId?: string | null }
) {
  const before = await getPlayerSnapshot(playerId)
  if (!before) throw new Error('Player not found')
  if (before.isMerged) throw new Error('Cannot edit a merged player')

  const alias = normalizeAlias(aliasRaw)
  if (!alias) throw new Error('Alias is required')

  if (before.aliases.some((a) => a.alias.toLowerCase() === alias.toLowerCase())) {
    return before
  }

  const db = getDb()
  await db.insert(playerAliases).values({ playerId, alias })

  const after = await getPlayerSnapshot(playerId)
  await writePlayerChange({
    playerId,
    source: opts.source ?? 'admin',
    actor: opts.actor,
    changeType: opts.source === 'import' ? 'import' : 'update',
    before: snapshotToJson(before),
    after: after ? snapshotToJson(after) : null,
    importBatchId: opts.importBatchId,
  })
  return after
}

export async function removePlayerAlias(
  playerId: string,
  aliasId: string,
  opts: { actor: string }
) {
  const before = await getPlayerSnapshot(playerId)
  if (!before) throw new Error('Player not found')
  if (before.isMerged) throw new Error('Cannot edit a merged player')

  const db = getDb()
  await db
    .delete(playerAliases)
    .where(and(eq(playerAliases.id, aliasId), eq(playerAliases.playerId, playerId)))

  const after = await getPlayerSnapshot(playerId)
  await writePlayerChange({
    playerId,
    source: 'admin',
    actor: opts.actor,
    changeType: 'update',
    before: snapshotToJson(before),
    after: after ? snapshotToJson(after) : null,
  })
  return after
}

export async function addPlayerHomeLeague(
  playerId: string,
  homeLeagueRaw: string,
  opts: { actor: string }
) {
  const before = await getPlayerSnapshot(playerId)
  if (!before) throw new Error('Player not found')
  if (before.isMerged) throw new Error('Cannot edit a merged player')

  if (!isValidHomeLeague(homeLeagueRaw)) {
    throw new Error('Invalid home league')
  }
  if (before.homeLeagues.some((h) => h.homeLeague === homeLeagueRaw)) {
    throw new Error('Home league already on this player')
  }

  const db = getDb()
  const [agg] = await db
    .select({ maxSort: max(playerHomeLeagues.sortOrder) })
    .from(playerHomeLeagues)
    .where(eq(playerHomeLeagues.playerId, playerId))
  const nextSort = (agg?.maxSort ?? -1) + 1

  await db.insert(playerHomeLeagues).values({
    playerId,
    homeLeague: homeLeagueRaw,
    sortOrder: nextSort,
  })

  const after = await getPlayerSnapshot(playerId)
  await writePlayerChange({
    playerId,
    source: 'admin',
    actor: opts.actor,
    changeType: 'update',
    before: snapshotToJson(before),
    after: after ? snapshotToJson(after) : null,
  })
  return after
}

export async function removePlayerHomeLeague(
  playerId: string,
  homeLeagueId: string,
  opts: { actor: string }
) {
  const before = await getPlayerSnapshot(playerId)
  if (!before) throw new Error('Player not found')
  if (before.isMerged) throw new Error('Cannot edit a merged player')

  const db = getDb()
  await db
    .delete(playerHomeLeagues)
    .where(
      and(eq(playerHomeLeagues.id, homeLeagueId), eq(playerHomeLeagues.playerId, playerId))
    )

  const remaining = await db
    .select()
    .from(playerHomeLeagues)
    .where(eq(playerHomeLeagues.playerId, playerId))
    .orderBy(asc(playerHomeLeagues.sortOrder))

  for (let i = 0; i < remaining.length; i++) {
    if (remaining[i].sortOrder !== i) {
      await db
        .update(playerHomeLeagues)
        .set({ sortOrder: i })
        .where(eq(playerHomeLeagues.id, remaining[i].id))
    }
  }

  const after = await getPlayerSnapshot(playerId)
  await writePlayerChange({
    playerId,
    source: 'admin',
    actor: opts.actor,
    changeType: 'update',
    before: snapshotToJson(before),
    after: after ? snapshotToJson(after) : null,
  })
  return after
}

export async function reorderPlayerHomeLeagues(
  playerId: string,
  homeLeagueIds: string[],
  opts: { actor: string }
) {
  const before = await getPlayerSnapshot(playerId)
  if (!before) throw new Error('Player not found')
  if (before.isMerged) throw new Error('Cannot edit a merged player')

  const existingIds = before.homeLeagues.map((h) => h.id)
  if (homeLeagueIds.length !== existingIds.length) {
    throw new Error('Home league reorder must include every current home league')
  }
  const existingSet = new Set(existingIds)
  const seen = new Set<string>()
  for (const id of homeLeagueIds) {
    if (!existingSet.has(id)) {
      throw new Error('Unknown home league id in reorder')
    }
    if (seen.has(id)) {
      throw new Error('Duplicate home league id in reorder')
    }
    seen.add(id)
  }

  const db = getDb()
  for (let i = 0; i < homeLeagueIds.length; i++) {
    await db
      .update(playerHomeLeagues)
      .set({ sortOrder: i })
      .where(
        and(eq(playerHomeLeagues.id, homeLeagueIds[i]), eq(playerHomeLeagues.playerId, playerId))
      )
  }

  const after = await getPlayerSnapshot(playerId)
  await writePlayerChange({
    playerId,
    source: 'admin',
    actor: opts.actor,
    changeType: 'update',
    before: snapshotToJson(before),
    after: after ? snapshotToJson(after) : null,
  })
  return after
}

async function findEmailOwner(email: string): Promise<string | null> {
  const db = getDb()
  const [row] = await db
    .select({ playerId: playerEmails.playerId })
    .from(playerEmails)
    .where(eq(playerEmails.email, email))
    .limit(1)
  return row?.playerId ?? null
}

/** Attach email if missing; no-op if already on player. Throws if on another player. */
export async function ensurePlayerEmail(
  playerId: string,
  emailRaw: string,
  opts: { actor: string; importBatchId?: string | null }
) {
  const email = normalizeEmail(emailRaw)
  if (!email) return getPlayerSnapshot(playerId)

  const owner = await findEmailOwner(email)
  if (owner === playerId) return getPlayerSnapshot(playerId)
  if (owner) throw new Error(`Email ${email} belongs to another player`)

  const before = await getPlayerSnapshot(playerId)
  if (!before) throw new Error('Player not found')

  const db = getDb()
  await db.insert(playerEmails).values({
    playerId,
    email,
    isPrimary: before.emails.length === 0,
  })

  const after = await getPlayerSnapshot(playerId)
  await writePlayerChange({
    playerId,
    source: 'import',
    actor: opts.actor,
    changeType: 'import',
    before: snapshotToJson(before),
    after: after ? snapshotToJson(after) : null,
    importBatchId: opts.importBatchId,
  })
  return after
}

export async function ensurePlayerAlias(
  playerId: string,
  aliasRaw: string,
  opts: { actor: string; importBatchId?: string | null }
) {
  return addPlayerAlias(playerId, aliasRaw, {
    actor: opts.actor,
    source: 'import',
    importBatchId: opts.importBatchId,
  })
}

/**
 * Apply the same patch to many players. Home-league add is idempotent;
 * remove-by-code is a no-op when the league is not on the player.
 */
export async function bulkUpdatePlayers(
  playerIds: string[],
  patch: BulkPlayerPatch,
  opts: { actor: string }
): Promise<{ updated: number; players: PlayerSnapshot[] }> {
  if (playerIds.length === 0) {
    throw new Error('playerIds must be a non-empty array')
  }
  if (
    !bulkPatchHasCoreFields(patch) &&
    patch.addHomeLeague === undefined &&
    patch.removeHomeLeague === undefined
  ) {
    throw new Error('patch must include at least one field to update')
  }

  const results: PlayerSnapshot[] = []

  for (const playerId of playerIds) {
    let snapshot = await getPlayerSnapshot(playerId)
    if (!snapshot) {
      throw new Error(`Player not found: ${playerId}`)
    }
    if (snapshot.isMerged) {
      throw new Error(`Cannot edit a merged player: ${playerId}`)
    }

    if (bulkPatchHasCoreFields(patch)) {
      const next = await updatePlayer(
        playerId,
        {
          gender: patch.gender,
          skillLevel: patch.skillLevel,
          hasStrongPersonality: patch.hasStrongPersonality,
          strongPersonalityNotes: patch.strongPersonalityNotes,
        },
        { actor: opts.actor, source: 'admin' }
      )
      if (!next) throw new Error(`Player not found: ${playerId}`)
      snapshot = next
    }

    if (patch.addHomeLeague) {
      const already = snapshot.homeLeagues.some((h) => h.homeLeague === patch.addHomeLeague)
      if (!already) {
        const next = await addPlayerHomeLeague(playerId, patch.addHomeLeague, {
          actor: opts.actor,
        })
        if (!next) throw new Error(`Player not found: ${playerId}`)
        snapshot = next
      }
    }

    if (patch.removeHomeLeague) {
      const match = snapshot.homeLeagues.find((h) => h.homeLeague === patch.removeHomeLeague)
      if (match) {
        const next = await removePlayerHomeLeague(playerId, match.id, {
          actor: opts.actor,
        })
        if (!next) throw new Error(`Player not found: ${playerId}`)
        snapshot = next
      }
    }

    results.push(snapshot)
  }

  return { updated: results.length, players: results }
}
