import { eq, inArray } from 'drizzle-orm'
import { getDb } from '@/app/lib/db'
import { playerAliases, playerEmails, players } from '@/app/db/schema'
import { writePlayerChange } from '@/app/lib/players/audit'
import {
  getPlayerSnapshot,
  snapshotToJson,
} from '@/app/lib/players/queries'
import { isValidSkillLevel } from '@/app/lib/players/skill'
import { normalizeNamePart } from '@/app/lib/players/normalize'

export type MergeFieldResolution = {
  firstName?: string
  lastName?: string
  rosterName?: string
  jerseyNumber?: number | null
  skillLevel?: number | null
}

export async function mergePlayers(input: {
  survivorId: string
  loserIds: string[]
  fields?: MergeFieldResolution
  actor: string
}) {
  const survivorId = input.survivorId
  const loserIds = [...new Set(input.loserIds.filter((id) => id !== survivorId))]
  if (loserIds.length === 0) {
    throw new Error('Select at least one player to merge into the survivor')
  }

  const survivorBefore = await getPlayerSnapshot(survivorId)
  if (!survivorBefore) throw new Error('Survivor player not found')
  if (survivorBefore.isMerged) throw new Error('Survivor is already merged')

  const loserSnapshots = []
  for (const id of loserIds) {
    const snap = await getPlayerSnapshot(id)
    if (!snap) throw new Error(`Player not found: ${id}`)
    if (snap.isMerged) throw new Error(`Player already merged: ${id}`)
    loserSnapshots.push(snap)
  }

  const db = getDb()

  // Resolve core fields: start from survivor, fill blanks from losers, apply explicit overrides
  let firstName = survivorBefore.firstName
  let lastName = survivorBefore.lastName
  let rosterName = survivorBefore.rosterName
  let jerseyNumber = survivorBefore.jerseyNumber
  let skillLevel = survivorBefore.skillLevel

  for (const loser of loserSnapshots) {
    if (jerseyNumber == null && loser.jerseyNumber != null) jerseyNumber = loser.jerseyNumber
    if (skillLevel == null && loser.skillLevel != null) skillLevel = loser.skillLevel
  }

  if (input.fields?.firstName !== undefined) {
    firstName = normalizeNamePart(input.fields.firstName)
  }
  if (input.fields?.lastName !== undefined) {
    lastName = normalizeNamePart(input.fields.lastName)
  }
  if (input.fields?.rosterName !== undefined) {
    rosterName = normalizeNamePart(input.fields.rosterName)
  }
  if (input.fields?.jerseyNumber !== undefined) {
    jerseyNumber = input.fields.jerseyNumber
  }
  if (input.fields?.skillLevel !== undefined) {
    if (input.fields.skillLevel !== null && !isValidSkillLevel(input.fields.skillLevel)) {
      throw new Error('Invalid skill level')
    }
    skillLevel = input.fields.skillLevel
  }

  await db
    .update(players)
    .set({
      firstName,
      lastName,
      rosterName,
      jerseyNumber,
      skillLevel,
      updatedAt: new Date(),
    })
    .where(eq(players.id, survivorId))

  // Move emails (skip duplicates)
  const existingEmails = new Set(survivorBefore.emails.map((e) => e.email))
  for (const loser of loserSnapshots) {
    for (const email of loser.emails) {
      if (existingEmails.has(email.email)) {
        await db.delete(playerEmails).where(eq(playerEmails.id, email.id))
        continue
      }
      await db
        .update(playerEmails)
        .set({ playerId: survivorId, isPrimary: false })
        .where(eq(playerEmails.id, email.id))
      existingEmails.add(email.email)
    }
  }

  // Ensure at least one primary
  const survivorEmails = await db
    .select()
    .from(playerEmails)
    .where(eq(playerEmails.playerId, survivorId))
  if (survivorEmails.length > 0 && !survivorEmails.some((e) => e.isPrimary)) {
    const prefer =
      survivorEmails.find((e) => e.email === survivorBefore.emails.find((x) => x.isPrimary)?.email) ??
      survivorEmails[0]
    await db
      .update(playerEmails)
      .set({ isPrimary: true })
      .where(eq(playerEmails.id, prefer.id))
  }

  // Move aliases
  const existingAliases = new Set(
    survivorBefore.aliases.map((a) => a.alias.toLowerCase())
  )
  for (const loser of loserSnapshots) {
    for (const alias of loser.aliases) {
      if (existingAliases.has(alias.alias.toLowerCase())) {
        await db.delete(playerAliases).where(eq(playerAliases.id, alias.id))
        continue
      }
      await db
        .update(playerAliases)
        .set({ playerId: survivorId })
        .where(eq(playerAliases.id, alias.id))
      existingAliases.add(alias.alias.toLowerCase())
    }
    // Also add loser's first name as alias when it differs
    const firstAsAlias = loser.firstName.trim()
    if (
      firstAsAlias &&
      firstAsAlias.toLowerCase() !== firstName.toLowerCase() &&
      !existingAliases.has(firstAsAlias.toLowerCase())
    ) {
      await db.insert(playerAliases).values({
        playerId: survivorId,
        alias: firstAsAlias,
      })
      existingAliases.add(firstAsAlias.toLowerCase())
    }
  }

  // Soft-merge losers
  await db
    .update(players)
    .set({
      isMerged: true,
      mergedIntoPlayerId: survivorId,
      updatedAt: new Date(),
    })
    .where(inArray(players.id, loserIds))

  const survivorAfter = await getPlayerSnapshot(survivorId)

  await writePlayerChange({
    playerId: survivorId,
    source: 'admin',
    actor: input.actor,
    changeType: 'merge',
    before: snapshotToJson(survivorBefore),
    after: {
      ...(survivorAfter ? snapshotToJson(survivorAfter) : {}),
      mergedFrom: loserIds,
    },
  })

  for (const loser of loserSnapshots) {
    const loserAfter = await getPlayerSnapshot(loser.id)
    await writePlayerChange({
      playerId: loser.id,
      source: 'admin',
      actor: input.actor,
      changeType: 'merge',
      before: snapshotToJson(loser),
      after: loserAfter
        ? {
            ...snapshotToJson(loserAfter),
            mergedInto: survivorId,
          }
        : { mergedInto: survivorId },
    })
  }

  return {
    survivor: survivorAfter,
    mergedIds: loserIds,
  }
}
