import { eq } from 'drizzle-orm'
import { getDb } from '@/app/lib/db'
import { players } from '@/app/db/schema'
import {
  loadImportMatchIndex,
  resolvePlayerIdByEmailOrName,
  type ImportMatchIndex,
} from '@/app/lib/players/import-match'
import { normalizeEmail, normalizeNamePart } from '@/app/lib/players/normalize'

const SYNC_HEADER = 'x-bdl-player-sync-secret'

/** Drizzle columns that player-app sync may write on `players`. */
export const PLAYER_APP_SYNC_WRITABLE_COLUMNS = [
  'playerAppAccountId',
  'selfReportedSkill',
  'firstName',
  'lastName',
  'updatedAt',
] as const

export type PlayerAppSelfReportedSkill =
  | 'beginner'
  | 'intermediate'
  | 'advanced'
  | 'highly_advanced'

export type PlayerAppChangeProfile = {
  accountId: string
  email: string
  firstName: string | null
  lastName: string | null
  selfReportedSkill: PlayerAppSelfReportedSkill | null
  updatedAt: string
}

export type PlayerAppChangesResponse = {
  version: string
  cursor: string | null
  profiles: PlayerAppChangeProfile[]
}

export type PlayerAppSyncConfig = {
  baseUrl: string
  secret: string
}

export function readPlayerAppSyncConfig(): PlayerAppSyncConfig | null {
  const baseUrl = process.env.PLAYER_APP_BASE_URL?.trim().replace(/\/$/, '')
  const secret = process.env.PLAYER_SYNC_SECRET?.trim()
  if (!baseUrl || !secret) return null
  return { baseUrl, secret }
}

export function selfReportedSkillToOperational(
  skill: PlayerAppSelfReportedSkill | null
): number | null {
  if (!skill) return null
  switch (skill) {
    case 'beginner':
      return 20
    case 'intermediate':
      return 40
    case 'advanced':
      return 60
    case 'highly_advanced':
      return 80
    default:
      return null
  }
}

export type PlayerAppSyncPatch = {
  playerAppAccountId: string
  selfReportedSkill: number | null
  firstName?: string
  lastName?: string
}

export function buildPlayerAppSyncPatch(
  profile: PlayerAppChangeProfile,
  existing: {
    firstName: string
    lastName: string
    selfReportedSkill: number | null
    playerAppAccountId: string | null
  }
): PlayerAppSyncPatch | null {
  const nextSkill = selfReportedSkillToOperational(profile.selfReportedSkill)
  const patch: PlayerAppSyncPatch = {
    playerAppAccountId: profile.accountId,
    selfReportedSkill: nextSkill,
  }

  const firstName = profile.firstName ? normalizeNamePart(profile.firstName) : ''
  const lastName = profile.lastName ? normalizeNamePart(profile.lastName) : ''
  if (firstName && firstName !== existing.firstName) patch.firstName = firstName
  if (lastName && lastName !== existing.lastName) patch.lastName = lastName

  const skillUnchanged =
    nextSkill === existing.selfReportedSkill ||
    (nextSkill == null && existing.selfReportedSkill == null)
  const accountUnchanged = existing.playerAppAccountId === profile.accountId
  const namesUnchanged = patch.firstName === undefined && patch.lastName === undefined

  if (skillUnchanged && accountUnchanged && namesUnchanged) return null
  return patch
}

export type ResolvePlayerAppProfileResult =
  | { status: 'matched'; playerId: string }
  | { status: 'skip'; reason: string }
  | { status: 'ambiguous'; reason: string; playerIds: string[] }

export function resolvePlayerForAppProfile(
  index: ImportMatchIndex,
  profile: PlayerAppChangeProfile
): ResolvePlayerAppProfileResult {
  const stickyId = index.accountIdToPlayerId.get(profile.accountId)
  if (stickyId) {
    const existing = index.playersById.get(stickyId)
    if (!existing) {
      return { status: 'skip', reason: 'Linked player record missing' }
    }
    if (existing.isMerged) {
      return { status: 'skip', reason: 'Linked player is merged' }
    }
    return { status: 'matched', playerId: stickyId }
  }

  const firstName = profile.firstName ? normalizeNamePart(profile.firstName) : ''
  const lastName = profile.lastName ? normalizeNamePart(profile.lastName) : ''
  if (!firstName || !lastName) {
    return { status: 'skip', reason: 'Profile missing first or last name for email/name match' }
  }

  const email = normalizeEmail(profile.email)
  const resolution = resolvePlayerIdByEmailOrName(index, {
    email,
    firstName,
    lastName,
  })
  if (resolution.status === 'ambiguous') {
    return {
      status: 'ambiguous',
      reason: resolution.reason,
      playerIds: resolution.playerIds,
    }
  }
  if (resolution.status === 'not_found') {
    return { status: 'skip', reason: 'No operational player matched email or name' }
  }

  const existing = index.playersById.get(resolution.playerId)
  if (!existing) {
    return { status: 'skip', reason: 'Matched player record missing' }
  }
  if (existing.isMerged) {
    return { status: 'skip', reason: 'Matched player is merged' }
  }
  if (
    existing.playerAppAccountId &&
    existing.playerAppAccountId !== profile.accountId
  ) {
    return {
      status: 'skip',
      reason: 'Player already linked to a different player-app account',
    }
  }

  return { status: 'matched', playerId: resolution.playerId }
}

export async function fetchPlayerAppChanges(
  config: PlayerAppSyncConfig,
  since: string | null,
  fetchImpl: typeof fetch = fetch
): Promise<PlayerAppChangesResponse> {
  const url = new URL(`${config.baseUrl}/api/internal/v1/changes`)
  if (since) url.searchParams.set('since', since)

  const res = await fetchImpl(url.toString(), {
    method: 'GET',
    headers: {
      [SYNC_HEADER]: config.secret,
      Accept: 'application/json',
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(
      `Player app changes fetch failed (${res.status})${text ? `: ${text.slice(0, 200)}` : ''}`
    )
  }

  return (await res.json()) as PlayerAppChangesResponse
}

export type PlayerAppSyncApplyResult = {
  applied: number
  skipped: number
  ambiguous: number
  errors: { accountId: string; message: string }[]
  cursor: string | null
}

export async function applyPlayerAppChanges(
  profiles: PlayerAppChangeProfile[],
  cursor: string | null
): Promise<PlayerAppSyncApplyResult> {
  const index = await loadImportMatchIndex()
  const db = getDb()
  let applied = 0
  let skipped = 0
  let ambiguous = 0
  const errors: { accountId: string; message: string }[] = []

  for (const profile of profiles) {
    try {
      const resolution = resolvePlayerForAppProfile(index, profile)
      if (resolution.status === 'ambiguous') {
        ambiguous++
        continue
      }
      if (resolution.status === 'skip') {
        skipped++
        continue
      }

      const existing = index.playersById.get(resolution.playerId)
      if (!existing) {
        skipped++
        continue
      }

      const finalPatch = buildPlayerAppSyncPatch(profile, {
        firstName: existing.firstName,
        lastName: existing.lastName,
        selfReportedSkill: existing.selfReportedSkill,
        playerAppAccountId: existing.playerAppAccountId,
      })

      if (!finalPatch) {
        skipped++
        continue
      }

      await db
        .update(players)
        .set({
          playerAppAccountId: finalPatch.playerAppAccountId,
          selfReportedSkill: finalPatch.selfReportedSkill,
          ...(finalPatch.firstName !== undefined
            ? { firstName: finalPatch.firstName }
            : {}),
          ...(finalPatch.lastName !== undefined ? { lastName: finalPatch.lastName } : {}),
          updatedAt: new Date(),
        })
        .where(eq(players.id, resolution.playerId))

      applied++
      index.playersById.set(resolution.playerId, {
        ...existing,
        firstName: finalPatch.firstName ?? existing.firstName,
        lastName: finalPatch.lastName ?? existing.lastName,
        playerAppAccountId: finalPatch.playerAppAccountId,
        selfReportedSkill: finalPatch.selfReportedSkill,
      })
    } catch (err) {
      errors.push({
        accountId: profile.accountId,
        message: err instanceof Error ? err.message : 'Apply failed',
      })
    }
  }

  return { applied, skipped, ambiguous, errors, cursor }
}

export async function pullAndApplyPlayerAppChanges(
  since: string | null,
  fetchImpl?: typeof fetch
): Promise<PlayerAppSyncApplyResult & { configured: boolean }> {
  const config = readPlayerAppSyncConfig()
  if (!config) {
    return {
      configured: false,
      applied: 0,
      skipped: 0,
      ambiguous: 0,
      errors: [],
      cursor: since,
    }
  }

  const feed = await fetchPlayerAppChanges(config, since, fetchImpl)
  const result = await applyPlayerAppChanges(feed.profiles, feed.cursor)
  return { configured: true, ...result }
}
