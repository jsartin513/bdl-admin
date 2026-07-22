import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { getDb } from '@/app/lib/db'
import {
  playerAliases,
  playerChanges,
  playerEmails,
  playerHomeLeagues,
  players,
} from '@/app/db/schema'
import { writePlayerChange } from '@/app/lib/players/audit'
import {
  getPlayerSnapshot,
  snapshotToJson,
} from '@/app/lib/players/queries'
import {
  isValidSkillLevel,
  normalizeStoredJerseyName,
  normalizeStoredNickname,
} from '@/app/lib/players/skill'
import { isValidGender } from '@/app/lib/players/gender'
import { isValidHomeLeague } from '@/app/lib/players/home-league'
import { normalizeEmail, normalizeNamePart } from '@/app/lib/players/normalize'

export type MergeFieldResolution = {
  firstName?: string
  lastName?: string
  rosterName?: string
  nickname?: string | null
  jerseyNumber?: number | null
  jerseyName?: string | null
  skillLevel?: number | null
  gender?: string | null
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
  let nicknameCustom = survivorBefore.nicknameCustom
  let jerseyNumber = survivorBefore.jerseyNumber
  let jerseyNameCustom = survivorBefore.jerseyNameCustom
  let skillLevel = survivorBefore.skillLevel
  let gender = survivorBefore.gender

  for (const loser of loserSnapshots) {
    if (jerseyNumber == null && loser.jerseyNumber != null) jerseyNumber = loser.jerseyNumber
    if (skillLevel == null && loser.skillLevel != null) skillLevel = loser.skillLevel
    if (gender == null && loser.gender != null) gender = loser.gender
    if (nicknameCustom == null && loser.nicknameCustom != null) {
      nicknameCustom = loser.nicknameCustom
    }
    if (jerseyNameCustom == null && loser.jerseyNameCustom != null) {
      jerseyNameCustom = loser.jerseyNameCustom
    }
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
  if (input.fields?.gender !== undefined) {
    if (input.fields.gender !== null && !isValidGender(input.fields.gender)) {
      throw new Error('Invalid gender')
    }
    gender = input.fields.gender
  }
  if (input.fields?.nickname !== undefined) {
    nicknameCustom = normalizeStoredNickname(input.fields.nickname, firstName, lastName)
  } else if (nicknameCustom != null) {
    // Re-normalize against resolved names (may clear back to default).
    nicknameCustom = normalizeStoredNickname(nicknameCustom, firstName, lastName)
  }
  if (input.fields?.jerseyName !== undefined) {
    jerseyNameCustom = normalizeStoredJerseyName(input.fields.jerseyName, lastName)
  } else if (jerseyNameCustom != null) {
    jerseyNameCustom = normalizeStoredJerseyName(jerseyNameCustom, lastName)
  }

  await db
    .update(players)
    .set({
      firstName,
      lastName,
      rosterName,
      nickname: nicknameCustom,
      jerseyNumber,
      jerseyName: jerseyNameCustom,
      skillLevel,
      gender,
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

  // Move home leagues (skip duplicates; append after survivor order)
  const existingHomeLeagues = new Set(
    survivorBefore.homeLeagues.map((h) => h.homeLeague)
  )
  let nextHomeLeagueSort = survivorBefore.homeLeagues.length
  for (const loser of loserSnapshots) {
    for (const homeLeague of loser.homeLeagues) {
      if (existingHomeLeagues.has(homeLeague.homeLeague)) {
        await db
          .delete(playerHomeLeagues)
          .where(eq(playerHomeLeagues.id, homeLeague.id))
        continue
      }
      await db
        .update(playerHomeLeagues)
        .set({ playerId: survivorId, sortOrder: nextHomeLeagueSort })
        .where(eq(playerHomeLeagues.id, homeLeague.id))
      existingHomeLeagues.add(homeLeague.homeLeague)
      nextHomeLeagueSort += 1
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

type SnapshotEmail = { id?: string; email: string; isPrimary?: boolean }
type SnapshotAlias = { id?: string; alias: string }
type SnapshotHomeLeague = { id?: string; homeLeague: string; sortOrder?: number }

function readMergeBefore(before: Record<string, unknown> | null | undefined): {
  emails: SnapshotEmail[]
  aliases: SnapshotAlias[]
  homeLeagues: SnapshotHomeLeague[]
  firstName: string | null
} {
  const emailsRaw = before?.emails
  const aliasesRaw = before?.aliases
  const homeLeaguesRaw = before?.homeLeagues
  const emails: SnapshotEmail[] = []
  if (Array.isArray(emailsRaw)) {
    for (const item of emailsRaw) {
      if (!item || typeof item !== 'object') continue
      const email = (item as { email?: unknown }).email
      if (typeof email !== 'string' || !email.trim()) continue
      emails.push({
        email: normalizeEmail(email),
        isPrimary: Boolean((item as { isPrimary?: unknown }).isPrimary),
      })
    }
  }
  const aliases: SnapshotAlias[] = []
  if (Array.isArray(aliasesRaw)) {
    for (const item of aliasesRaw) {
      if (!item || typeof item !== 'object') continue
      const alias = (item as { alias?: unknown }).alias
      if (typeof alias !== 'string' || !alias.trim()) continue
      aliases.push({ alias: alias.trim() })
    }
  }
  const homeLeagues: SnapshotHomeLeague[] = []
  if (Array.isArray(homeLeaguesRaw)) {
    for (const item of homeLeaguesRaw) {
      if (!item || typeof item !== 'object') continue
      const homeLeague = (item as { homeLeague?: unknown }).homeLeague
      if (typeof homeLeague !== 'string' || !isValidHomeLeague(homeLeague)) continue
      const sortOrderRaw = (item as { sortOrder?: unknown }).sortOrder
      homeLeagues.push({
        homeLeague,
        sortOrder: typeof sortOrderRaw === 'number' ? sortOrderRaw : undefined,
      })
    }
  }
  homeLeagues.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  const firstName =
    typeof before?.firstName === 'string' ? before.firstName.trim() : null
  return { emails, aliases, homeLeagues, firstName }
}

/**
 * Reverse a soft-merge: reactivate the merged player and move emails/aliases
 * that still live on the survivor back using the merge audit snapshot.
 * Does not undo core-field fills (jersey/skill/gender) on the survivor.
 */
export async function unmergePlayer(input: { playerId: string; actor: string }) {
  const playerId = input.playerId
  const before = await getPlayerSnapshot(playerId)
  if (!before) throw new Error('Player not found')
  if (!before.isMerged) throw new Error('Player is not merged')
  const survivorId = before.mergedIntoPlayerId
  if (!survivorId) throw new Error('Merged player is missing survivor reference')

  const survivorBefore = await getPlayerSnapshot(survivorId)
  if (!survivorBefore) throw new Error('Survivor player not found')

  const db = getDb()
  const [mergeEvent] = await db
    .select()
    .from(playerChanges)
    .where(and(eq(playerChanges.playerId, playerId), eq(playerChanges.changeType, 'merge')))
    .orderBy(desc(playerChanges.createdAt))
    .limit(1)

  const mergeBefore = readMergeBefore(mergeEvent?.before ?? null)

  // Find the survivor's merge audit for this pair so we know which emails/aliases
  // they already owned (duplicates deleted on merge — leave those on survivor).
  const survivorMergeEvents = await db
    .select()
    .from(playerChanges)
    .where(
      and(eq(playerChanges.playerId, survivorId), eq(playerChanges.changeType, 'merge'))
    )
    .orderBy(desc(playerChanges.createdAt))

  const survivorMergeEvent =
    survivorMergeEvents.find((event) => {
      const mergedFrom = (event.after as { mergedFrom?: unknown } | null)?.mergedFrom
      return Array.isArray(mergedFrom) && mergedFrom.includes(playerId)
    }) ?? null
  const survivorOwnedBefore = readMergeBefore(survivorMergeEvent?.before ?? null)
  const survivorHadEmail = new Set(survivorOwnedBefore.emails.map((e) => e.email))
  const survivorHadAlias = new Set(
    survivorOwnedBefore.aliases.map((a) => a.alias.toLowerCase())
  )
  const survivorHadHomeLeague = new Set(
    survivorOwnedBefore.homeLeagues.map((h) => h.homeLeague)
  )
  const canDetectSurvivorOwned = survivorMergeEvent != null

  await db
    .update(players)
    .set({
      isMerged: false,
      mergedIntoPlayerId: null,
      updatedAt: new Date(),
    })
    .where(eq(players.id, playerId))

  // Restore emails that were moved from this player onto the survivor.
  // If the survivor already had the address at merge time, leave it there.
  for (const email of mergeBefore.emails) {
    if (canDetectSurvivorOwned && survivorHadEmail.has(email.email)) continue

    const [existing] = await db
      .select()
      .from(playerEmails)
      .where(eq(playerEmails.email, email.email))
      .limit(1)

    if (!existing) {
      await db.insert(playerEmails).values({
        playerId,
        email: email.email,
        isPrimary: Boolean(email.isPrimary),
      })
      continue
    }

    if (existing.playerId === playerId) continue

    // Without the survivor merge audit we can't tell move vs duplicate — leave it.
    if (existing.playerId === survivorId && canDetectSurvivorOwned) {
      await db
        .update(playerEmails)
        .set({ playerId, isPrimary: Boolean(email.isPrimary) })
        .where(eq(playerEmails.id, existing.id))
    }
  }

  // Ensure both sides have a primary when they have emails
  for (const id of [playerId, survivorId]) {
    const emails = await db.select().from(playerEmails).where(eq(playerEmails.playerId, id))
    if (emails.length === 0) continue
    if (emails.some((e) => e.isPrimary)) continue
    await db
      .update(playerEmails)
      .set({ isPrimary: true })
      .where(eq(playerEmails.id, emails[0].id))
  }

  // Restore aliases that were moved (skip ones the survivor already had).
  for (const alias of mergeBefore.aliases) {
    if (canDetectSurvivorOwned && survivorHadAlias.has(alias.alias.toLowerCase())) {
      continue
    }

    const [onSurvivor] = await db
      .select()
      .from(playerAliases)
      .where(
        and(
          eq(playerAliases.playerId, survivorId),
          eq(playerAliases.alias, alias.alias)
        )
      )
      .limit(1)
    if (onSurvivor && canDetectSurvivorOwned) {
      await db
        .update(playerAliases)
        .set({ playerId })
        .where(eq(playerAliases.id, onSurvivor.id))
      continue
    }

    const [already] = await db
      .select()
      .from(playerAliases)
      .where(and(eq(playerAliases.playerId, playerId), eq(playerAliases.alias, alias.alias)))
      .limit(1)
    if (!already) {
      await db.insert(playerAliases).values({ playerId, alias: alias.alias })
    }
  }

  // Drop first-name alias that merge may have added onto the survivor
  if (
    mergeBefore.firstName &&
    survivorBefore.firstName.toLowerCase() !== mergeBefore.firstName.toLowerCase() &&
    !survivorHadAlias.has(mergeBefore.firstName.toLowerCase())
  ) {
    await db
      .delete(playerAliases)
      .where(
        and(
          eq(playerAliases.playerId, survivorId),
          eq(playerAliases.alias, mergeBefore.firstName)
        )
      )
  }

  // Restore home leagues that were moved (skip ones the survivor already had).
  for (const homeLeague of mergeBefore.homeLeagues) {
    if (canDetectSurvivorOwned && survivorHadHomeLeague.has(homeLeague.homeLeague)) {
      continue
    }

    const [onSurvivor] = await db
      .select()
      .from(playerHomeLeagues)
      .where(
        and(
          eq(playerHomeLeagues.playerId, survivorId),
          eq(playerHomeLeagues.homeLeague, homeLeague.homeLeague)
        )
      )
      .limit(1)
    if (onSurvivor && canDetectSurvivorOwned) {
      await db
        .update(playerHomeLeagues)
        .set({ playerId })
        .where(eq(playerHomeLeagues.id, onSurvivor.id))
      continue
    }

    const [already] = await db
      .select()
      .from(playerHomeLeagues)
      .where(
        and(
          eq(playerHomeLeagues.playerId, playerId),
          eq(playerHomeLeagues.homeLeague, homeLeague.homeLeague)
        )
      )
      .limit(1)
    if (!already) {
      const [agg] = await db
        .select({ maxSort: playerHomeLeagues.sortOrder })
        .from(playerHomeLeagues)
        .where(eq(playerHomeLeagues.playerId, playerId))
        .orderBy(desc(playerHomeLeagues.sortOrder))
        .limit(1)
      await db.insert(playerHomeLeagues).values({
        playerId,
        homeLeague: homeLeague.homeLeague,
        sortOrder: (agg?.maxSort ?? -1) + 1,
      })
    }
  }

  // Compact sort orders on both sides after restore
  for (const id of [playerId, survivorId]) {
    const ordered = await db
      .select()
      .from(playerHomeLeagues)
      .where(eq(playerHomeLeagues.playerId, id))
      .orderBy(asc(playerHomeLeagues.sortOrder))
    for (let i = 0; i < ordered.length; i++) {
      if (ordered[i].sortOrder !== i) {
        await db
          .update(playerHomeLeagues)
          .set({ sortOrder: i })
          .where(eq(playerHomeLeagues.id, ordered[i].id))
      }
    }
  }

  const playerAfter = await getPlayerSnapshot(playerId)
  const survivorAfter = await getPlayerSnapshot(survivorId)

  await writePlayerChange({
    playerId,
    source: 'admin',
    actor: input.actor,
    changeType: 'unmerge',
    before: snapshotToJson(before),
    after: {
      ...(playerAfter ? snapshotToJson(playerAfter) : {}),
      unmergedFrom: survivorId,
    },
  })

  await writePlayerChange({
    playerId: survivorId,
    source: 'admin',
    actor: input.actor,
    changeType: 'unmerge',
    before: snapshotToJson(survivorBefore),
    after: {
      ...(survivorAfter ? snapshotToJson(survivorAfter) : {}),
      unmergedPlayerId: playerId,
    },
  })

  return {
    player: playerAfter,
    survivor: survivorAfter,
  }
}
