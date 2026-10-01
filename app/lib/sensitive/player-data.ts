import { and, desc, eq } from 'drizzle-orm'
import { getDb } from '@/app/lib/db'
import { playerChanges, players } from '@/app/db/schema'
import {
  playerOfficialSkill,
  playerPersonality,
  playerPersonNotes,
  sensitivePlayerChanges,
  type SkillAreasJson,
} from '@/app/db/sensitive-schema'
import { getSensitiveDb, isSensitiveDatabaseConfigured } from '@/app/lib/sensitive/db'
import type { ChangeSource, ChangeType } from '@/app/lib/players/types'

export type OfficialSkillBundle = {
  skillLevel: number | null
  skillLevelFib: number | null
  skillAreas: SkillAreasJson
  hasStrongPersonality: boolean
  strongPersonalityNotes: string | null
}

export type PlayerChangeRow = {
  id: string
  playerId: string
  source: string
  actor: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  changeType: string
  importBatchId: string | null
  createdAt: Date
}

export async function getOfficialSkillBundle(
  playerId: string
): Promise<OfficialSkillBundle | null> {
  if (!isSensitiveDatabaseConfigured()) {
    const db = getDb()
    const [row] = await db
      .select({
        skillLevel: players.skillLevel,
        skillLevelFib: players.skillLevelFib,
        skillAreas: players.skillAreas,
        hasStrongPersonality: players.hasStrongPersonality,
        strongPersonalityNotes: players.strongPersonalityNotes,
      })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1)
    return row ?? null
  }

  const db = getSensitiveDb()
  const [skill] = await db
    .select()
    .from(playerOfficialSkill)
    .where(eq(playerOfficialSkill.playerId, playerId))
    .limit(1)
  const [personality] = await db
    .select()
    .from(playerPersonality)
    .where(eq(playerPersonality.playerId, playerId))
    .limit(1)

  if (!skill && !personality) {
    const dbOp = getDb()
    const [row] = await dbOp
      .select({
        skillLevel: players.skillLevel,
        skillLevelFib: players.skillLevelFib,
        skillAreas: players.skillAreas,
        hasStrongPersonality: players.hasStrongPersonality,
        strongPersonalityNotes: players.strongPersonalityNotes,
      })
      .from(players)
      .where(eq(players.id, playerId))
      .limit(1)
    return row ?? null
  }

  const dbOp = getDb()
  const [opRow] = await dbOp
    .select({
      skillLevel: players.skillLevel,
      skillLevelFib: players.skillLevelFib,
      skillAreas: players.skillAreas,
      hasStrongPersonality: players.hasStrongPersonality,
      strongPersonalityNotes: players.strongPersonalityNotes,
    })
    .from(players)
    .where(eq(players.id, playerId))
    .limit(1)

  const fallback = opRow ?? {
    skillLevel: null,
    skillLevelFib: null,
    skillAreas: null,
    hasStrongPersonality: false,
    strongPersonalityNotes: null,
  }

  return {
    skillLevel: skill?.skillLevel ?? fallback.skillLevel,
    skillLevelFib: skill?.skillLevelFib ?? fallback.skillLevelFib,
    skillAreas: skill?.skillAreas ?? fallback.skillAreas ?? null,
    hasStrongPersonality:
      personality?.hasStrongPersonality ?? fallback.hasStrongPersonality,
    strongPersonalityNotes:
      personality?.strongPersonalityNotes ?? fallback.strongPersonalityNotes,
  }
}

export async function upsertOfficialSkillBundle(
  playerId: string,
  patch: Partial<{
    skillLevel: number | null
    skillLevelFib: number | null
    skillAreas: SkillAreasJson
    hasStrongPersonality: boolean
    strongPersonalityNotes: string | null
  }>
) {
  if (!isSensitiveDatabaseConfigured()) return

  const db = getSensitiveDb()
  const now = new Date()

  const hasSkillPatch =
    patch.skillLevel !== undefined ||
    patch.skillLevelFib !== undefined ||
    patch.skillAreas !== undefined

  if (hasSkillPatch) {
    const [existing] = await db
      .select()
      .from(playerOfficialSkill)
      .where(eq(playerOfficialSkill.playerId, playerId))
      .limit(1)
    const next = {
      skillLevel:
        patch.skillLevel !== undefined ? patch.skillLevel : (existing?.skillLevel ?? null),
      skillLevelFib:
        patch.skillLevelFib !== undefined
          ? patch.skillLevelFib
          : (existing?.skillLevelFib ?? null),
      skillAreas:
        patch.skillAreas !== undefined ? patch.skillAreas : (existing?.skillAreas ?? null),
    }
    if (existing) {
      await db
        .update(playerOfficialSkill)
        .set({ ...next, updatedAt: now })
        .where(eq(playerOfficialSkill.playerId, playerId))
    } else {
      await db.insert(playerOfficialSkill).values({
        playerId,
        ...next,
        updatedAt: now,
      })
    }
  }

  const hasPersonalityPatch =
    patch.hasStrongPersonality !== undefined ||
    patch.strongPersonalityNotes !== undefined

  if (hasPersonalityPatch) {
    const [existing] = await db
      .select()
      .from(playerPersonality)
      .where(eq(playerPersonality.playerId, playerId))
      .limit(1)
    const next = {
      hasStrongPersonality:
        patch.hasStrongPersonality !== undefined
          ? patch.hasStrongPersonality
          : (existing?.hasStrongPersonality ?? false),
      strongPersonalityNotes:
        patch.strongPersonalityNotes !== undefined
          ? patch.strongPersonalityNotes
          : (existing?.strongPersonalityNotes ?? null),
    }
    if (existing) {
      await db
        .update(playerPersonality)
        .set({ ...next, updatedAt: now })
        .where(eq(playerPersonality.playerId, playerId))
    } else {
      await db.insert(playerPersonality).values({
        playerId,
        ...next,
        updatedAt: now,
      })
    }
  }
}

export async function listPersonNotes(playerId: string) {
  if (!isSensitiveDatabaseConfigured()) return []

  const db = getSensitiveDb()
  return db
    .select()
    .from(playerPersonNotes)
    .where(eq(playerPersonNotes.playerId, playerId))
    .orderBy(desc(playerPersonNotes.createdAt))
}

export async function addPersonNote(input: {
  playerId: string
  body: string
  actor: string
}) {
  if (!isSensitiveDatabaseConfigured()) {
    throw new Error('SENSITIVE_DATABASE_URL is not configured')
  }
  const body = input.body.trim()
  if (!body) throw new Error('Note body is required')

  const db = getSensitiveDb()
  const [row] = await db
    .insert(playerPersonNotes)
    .values({
      playerId: input.playerId,
      body,
      actor: input.actor,
    })
    .returning()
  return row
}

export async function listPlayerChangesForPlayer(playerId: string): Promise<PlayerChangeRow[]> {
  if (!isSensitiveDatabaseConfigured()) {
    const db = getDb()
    const rows = await db
      .select()
      .from(playerChanges)
      .where(eq(playerChanges.playerId, playerId))
      .orderBy(desc(playerChanges.createdAt))
    return rows.map(mapOperationalChange)
  }

  const db = getSensitiveDb()
  const rows = await db
    .select()
    .from(sensitivePlayerChanges)
    .where(eq(sensitivePlayerChanges.playerId, playerId))
    .orderBy(desc(sensitivePlayerChanges.createdAt))
  if (rows.length > 0) return rows.map(mapSensitiveChange)

  const dbOp = getDb()
  const fallback = await dbOp
    .select()
    .from(playerChanges)
    .where(eq(playerChanges.playerId, playerId))
    .orderBy(desc(playerChanges.createdAt))
  return fallback.map(mapOperationalChange)
}

export async function findLatestPlayerChange(
  playerId: string,
  changeType: ChangeType
): Promise<PlayerChangeRow | null> {
  const rows = await listPlayerChangesForPlayer(playerId)
  return rows.find((r) => r.changeType === changeType) ?? null
}

export async function findPlayerMergeChanges(playerId: string): Promise<PlayerChangeRow[]> {
  if (!isSensitiveDatabaseConfigured()) {
    const db = getDb()
    const rows = await db
      .select()
      .from(playerChanges)
      .where(and(eq(playerChanges.playerId, playerId), eq(playerChanges.changeType, 'merge')))
      .orderBy(desc(playerChanges.createdAt))
    return rows.map(mapOperationalChange)
  }

  const db = getSensitiveDb()
  const rows = await db
    .select()
    .from(sensitivePlayerChanges)
    .where(
      and(
        eq(sensitivePlayerChanges.playerId, playerId),
        eq(sensitivePlayerChanges.changeType, 'merge')
      )
    )
    .orderBy(desc(sensitivePlayerChanges.createdAt))
  if (rows.length > 0) return rows.map(mapSensitiveChange)

  const dbOp = getDb()
  const fallback = await dbOp
    .select()
    .from(playerChanges)
    .where(and(eq(playerChanges.playerId, playerId), eq(playerChanges.changeType, 'merge')))
    .orderBy(desc(playerChanges.createdAt))
  return fallback.map(mapOperationalChange)
}

export async function writePlayerChange(input: {
  playerId: string
  source: ChangeSource
  actor: string
  changeType: ChangeType
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  importBatchId?: string | null
}) {
  const db = getDb()
  await db.insert(playerChanges).values({
    playerId: input.playerId,
    source: input.source,
    actor: input.actor,
    changeType: input.changeType,
    before: input.before,
    after: input.after,
    importBatchId: input.importBatchId ?? null,
  })

  if (!isSensitiveDatabaseConfigured()) return

  const sensitiveDb = getSensitiveDb()
  await sensitiveDb.insert(sensitivePlayerChanges).values({
    playerId: input.playerId,
    source: input.source,
    actor: input.actor,
    changeType: input.changeType,
    before: input.before,
    after: input.after,
    importBatchId: input.importBatchId ?? null,
  })
}

function mapOperationalChange(row: typeof playerChanges.$inferSelect): PlayerChangeRow {
  return {
    id: row.id,
    playerId: row.playerId,
    source: row.source,
    actor: row.actor,
    before: row.before,
    after: row.after,
    changeType: row.changeType,
    importBatchId: row.importBatchId,
    createdAt: row.createdAt,
  }
}

function mapSensitiveChange(row: typeof sensitivePlayerChanges.$inferSelect): PlayerChangeRow {
  return {
    id: row.id,
    playerId: row.playerId,
    source: row.source,
    actor: row.actor,
    before: row.before,
    after: row.after,
    changeType: row.changeType,
    importBatchId: row.importBatchId,
    createdAt: row.createdAt,
  }
}
