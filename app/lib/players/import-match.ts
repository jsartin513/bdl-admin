import { getDb } from '@/app/lib/db'
import { playerEmails, players } from '@/app/db/schema'
import { normalizeEmail, nameKey } from '@/app/lib/players/normalize'

export type ImportMatchPlayer = {
  id: string
  firstName: string
  lastName: string
  rosterName: string
  jerseyNumber: number | null
  skillLevel: number | null
  gender: string | null
  isMerged: boolean
  playerAppAccountId: string | null
  selfReportedSkill: number | null
  emails: string[]
}

export type ImportMatchIndex = {
  emailToPlayerId: Map<string, string>
  nameToPlayerIds: Map<string, string[]>
  accountIdToPlayerId: Map<string, string>
  playersById: Map<string, ImportMatchPlayer>
}

export async function loadImportMatchIndex(): Promise<ImportMatchIndex> {
  const db = getDb()
  const [playerRows, emailRows] = await Promise.all([
    db.select().from(players),
    db.select().from(playerEmails),
  ])

  const emailsByPlayer = new Map<string, string[]>()
  const emailToPlayerId = new Map<string, string>()
  for (const e of emailRows) {
    emailToPlayerId.set(e.email, e.playerId)
    const list = emailsByPlayer.get(e.playerId) ?? []
    list.push(e.email)
    emailsByPlayer.set(e.playerId, list)
  }

  const playersById = new Map<string, ImportMatchPlayer>()
  const nameToPlayerIds = new Map<string, string[]>()
  const accountIdToPlayerId = new Map<string, string>()

  for (const p of playerRows) {
    playersById.set(p.id, {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      rosterName: p.rosterName,
      jerseyNumber: p.jerseyNumber,
      skillLevel: p.skillLevel,
      gender: p.gender,
      isMerged: p.isMerged,
      playerAppAccountId: p.playerAppAccountId,
      selfReportedSkill: p.selfReportedSkill,
      emails: emailsByPlayer.get(p.id) ?? [],
    })
    if (p.playerAppAccountId) {
      accountIdToPlayerId.set(p.playerAppAccountId, p.id)
    }
    if (p.isMerged) continue
    const key = nameKey(p.firstName, p.lastName)
    const list = nameToPlayerIds.get(key) ?? []
    list.push(p.id)
    nameToPlayerIds.set(key, list)
  }

  return { emailToPlayerId, nameToPlayerIds, accountIdToPlayerId, playersById }
}

export type EmailOrNameMatchInput = {
  email: string | null
  firstName: string
  lastName: string
}

export type EmailOrNameMatchResult =
  | { status: 'matched'; playerId: string }
  | { status: 'ambiguous'; reason: string; playerIds: string[] }
  | { status: 'not_found' }

/** TeamLinkt-style resolution: email first, then unique name match. */
export function resolvePlayerIdByEmailOrName(
  index: ImportMatchIndex,
  input: EmailOrNameMatchInput
): EmailOrNameMatchResult {
  const email = input.email ? normalizeEmail(input.email) : null

  let playerId: string | null = null
  if (email) {
    playerId = index.emailToPlayerId.get(email) ?? null
  }

  if (!playerId) {
    const byName =
      index.nameToPlayerIds.get(nameKey(input.firstName, input.lastName)) ?? []
    if (byName.length > 1) {
      return {
        status: 'ambiguous',
        reason:
          'Multiple players match this name; resolve manually or sync with a unique email',
        playerIds: byName,
      }
    }
    if (byName.length === 1) {
      playerId = byName[0]
      if (email) {
        const emailOwner = index.emailToPlayerId.get(email)
        if (emailOwner && emailOwner !== playerId) {
          return {
            status: 'ambiguous',
            reason: 'Name matches one player but email belongs to another',
            playerIds: [playerId, emailOwner],
          }
        }
      }
    }
  }

  if (!playerId) return { status: 'not_found' }
  return { status: 'matched', playerId }
}
