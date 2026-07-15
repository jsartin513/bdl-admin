import { and, eq } from 'drizzle-orm'
import { getDb } from '@/app/lib/db'
import { playerAliases, playerEmails, players } from '@/app/db/schema'
import { writePlayerChange } from '@/app/lib/players/audit'
import { defaultRosterName, isValidSkillLevel } from '@/app/lib/players/skill'
import {
  getPlayerSnapshot,
  snapshotToJson,
} from '@/app/lib/players/queries'
import { normalizeAlias, normalizeEmail, normalizeNamePart } from '@/app/lib/players/normalize'
import type { ChangeSource } from '@/app/lib/players/types'

export async function createPlayer(input: {
  firstName: string
  lastName: string
  rosterName?: string
  jerseyNumber?: number | null
  skillLevel?: number | null
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

  let skillLevel: number | null = null
  if (input.skillLevel != null) {
    if (!isValidSkillLevel(input.skillLevel)) throw new Error('Invalid skill level')
    skillLevel = input.skillLevel
  }

  const [created] = await db
    .insert(players)
    .values({
      firstName,
      lastName,
      rosterName,
      jerseyNumber: input.jerseyNumber ?? null,
      skillLevel,
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
    jerseyNumber?: number | null
    skillLevel?: number | null
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
