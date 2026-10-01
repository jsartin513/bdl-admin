import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { getDb } from '@/app/lib/db'
import {
  assertCaptainDraftPayload,
  DEFAULT_CAPTAIN_DRAFT_RULES,
  mapToCaptainPoolPlayer,
  type CaptainDraftRules,
  type CaptainDraftSnapshot,
} from '@/app/lib/captain-draft/contract'
import {
  eventLiveDraftPicks,
  eventLiveDrafts,
  eventRegistrations,
  events,
  playerEmails,
  players,
} from '@/app/db/schema'
import { resolveTeamName } from '@/app/lib/events/dodgeballhub-export'
import {
  countsForWomenNb,
  countsIntermediate,
  teamRequirementMeter,
} from '@/app/lib/events/live-draft-requirements'
import {
  defaultTeamOrderFromRegistrations,
  generatePickSequence,
  type LiveDraftOrderType,
} from '@/app/lib/events/live-draft-sequence'
import { resolveNickname } from '@/app/lib/players/skill'
import { normalizeEmail } from '@/app/lib/players/normalize'

export type LiveDraftStatus = 'setup' | 'live' | 'paused' | 'complete'

export type LiveDraftRecord = {
  id: string
  eventId: string
  status: LiveDraftStatus
  orderType: LiveDraftOrderType
  teamOrder: number[]
  customSlots: number[] | null
  pickSequence: number[]
  currentPickIndex: number
  rules: CaptainDraftRules
  startedAt: Date | null
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

type RegistrationRow = {
  id: string
  playerId: string
  draftGroup: number | null
  isCaptain: boolean
  teamLocked: boolean
  firstName: string
  lastName: string
  nickname: string | null
  gender: string | null
  skillLevel: number | null
  photoUrl: string | null
  hasStrongPersonality: boolean
  strongPersonalityNotes: string | null
}

function parseRules(raw: CaptainDraftRules | null | undefined): CaptainDraftRules {
  if (!raw) return { ...DEFAULT_CAPTAIN_DRAFT_RULES }
  return {
    minWomenNb: raw.minWomenNb ?? DEFAULT_CAPTAIN_DRAFT_RULES.minWomenNb,
    includeOtherInWomenNb:
      raw.includeOtherInWomenNb ?? DEFAULT_CAPTAIN_DRAFT_RULES.includeOtherInWomenNb,
    minIntermediate: raw.minIntermediate ?? DEFAULT_CAPTAIN_DRAFT_RULES.minIntermediate,
    intermediateMin: raw.intermediateMin ?? DEFAULT_CAPTAIN_DRAFT_RULES.intermediateMin,
    intermediateMax: raw.intermediateMax ?? DEFAULT_CAPTAIN_DRAFT_RULES.intermediateMax,
  }
}

function mapLiveDraftRow(row: typeof eventLiveDrafts.$inferSelect): LiveDraftRecord {
  return {
    id: row.id,
    eventId: row.eventId,
    status: row.status as LiveDraftStatus,
    orderType: row.orderType as LiveDraftOrderType,
    teamOrder: row.teamOrder ?? [],
    customSlots: row.customSlots ?? null,
    pickSequence: row.pickSequence ?? [],
    currentPickIndex: row.currentPickIndex,
    rules: parseRules(row.rules as CaptainDraftRules),
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

async function loadRegistrationRows(eventId: string): Promise<RegistrationRow[]> {
  const db = getDb()
  const rows = await db
    .select({
      id: eventRegistrations.id,
      playerId: eventRegistrations.playerId,
      draftGroup: eventRegistrations.draftGroup,
      isCaptain: eventRegistrations.isCaptain,
      teamLocked: eventRegistrations.teamLocked,
      firstName: players.firstName,
      lastName: players.lastName,
      nickname: players.nickname,
      gender: players.gender,
      skillLevel: players.skillLevel,
      photoUrl: players.photoUrl,
      hasStrongPersonality: players.hasStrongPersonality,
      strongPersonalityNotes: players.strongPersonalityNotes,
    })
    .from(eventRegistrations)
    .innerJoin(players, eq(players.id, eventRegistrations.playerId))
    .where(eq(eventRegistrations.eventId, eventId))

  return rows.map((r) => ({
    ...r,
    nickname: resolveNickname(r.nickname, r.firstName, r.lastName),
  }))
}

export async function getLiveDraftByEventId(eventId: string): Promise<LiveDraftRecord | null> {
  const db = getDb()
  const [row] = await db
    .select()
    .from(eventLiveDrafts)
    .where(eq(eventLiveDrafts.eventId, eventId))
    .limit(1)
  if (!row) return null
  return mapLiveDraftRow(row)
}

export async function ensureLiveDraft(eventId: string): Promise<LiveDraftRecord> {
  const existing = await getLiveDraftByEventId(eventId)
  if (existing) return existing

  const registrations = await loadRegistrationRows(eventId)
  const teamOrder = defaultTeamOrderFromRegistrations(registrations)

  const db = getDb()
  const [row] = await db
    .insert(eventLiveDrafts)
    .values({
      eventId,
      teamOrder,
      rules: DEFAULT_CAPTAIN_DRAFT_RULES,
    })
    .returning()
  return mapLiveDraftRow(row)
}

export type UpdateLiveDraftSetupInput = {
  orderType?: LiveDraftOrderType
  teamOrder?: number[]
  customSlots?: number[] | null
  rules?: Partial<CaptainDraftRules>
}

export async function updateLiveDraftSetup(
  eventId: string,
  input: UpdateLiveDraftSetupInput
): Promise<LiveDraftRecord> {
  const draft = await ensureLiveDraft(eventId)
  if (draft.status !== 'setup' && draft.status !== 'paused') {
    throw new Error('Cannot edit setup while draft is live or complete')
  }

  const nextRules = input.rules ? { ...draft.rules, ...input.rules } : draft.rules
  const nextOrderType = input.orderType ?? draft.orderType
  const nextTeamOrder = input.teamOrder ?? draft.teamOrder
  const nextCustom = input.customSlots !== undefined ? input.customSlots : draft.customSlots

  const db = getDb()
  const [row] = await db
    .update(eventLiveDrafts)
    .set({
      orderType: nextOrderType,
      teamOrder: nextTeamOrder,
      customSlots: nextCustom,
      rules: nextRules,
      updatedAt: new Date(),
    })
    .where(eq(eventLiveDrafts.id, draft.id))
    .returning()

  return mapLiveDraftRow(row)
}

export async function startLiveDraft(eventId: string): Promise<LiveDraftRecord> {
  const draft = await ensureLiveDraft(eventId)
  if (draft.status === 'complete') throw new Error('Draft is already complete')
  if (draft.status === 'live') return draft

  if (draft.status === 'paused') {
    const db = getDb()
    const [row] = await db
      .update(eventLiveDrafts)
      .set({ status: 'live', updatedAt: new Date() })
      .where(eq(eventLiveDrafts.id, draft.id))
      .returning()
    return mapLiveDraftRow(row)
  }

  const registrations = await loadRegistrationRows(eventId)
  const poolCount = registrations.filter((r) => r.draftGroup == null).length
  if (poolCount === 0) throw new Error('No unassigned players in the pool')

  const teamOrder =
    draft.teamOrder.length > 0
      ? draft.teamOrder
      : defaultTeamOrderFromRegistrations(registrations)
  if (teamOrder.length === 0) {
    throw new Error('Assign captains to teams before starting the live draft')
  }

  const pickSequence = generatePickSequence(
    draft.orderType,
    teamOrder,
    poolCount,
    draft.customSlots
  )

  const db = getDb()
  const [row] = await db
    .update(eventLiveDrafts)
    .set({
      status: 'live',
      teamOrder,
      pickSequence,
      currentPickIndex: 0,
      startedAt: draft.startedAt ?? new Date(),
      completedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(eventLiveDrafts.id, draft.id))
    .returning()

  return mapLiveDraftRow(row)
}

export async function setLiveDraftStatus(
  eventId: string,
  status: LiveDraftStatus
): Promise<LiveDraftRecord> {
  const draft = await ensureLiveDraft(eventId)
  if (status === 'setup' && draft.status === 'live') {
    throw new Error('Pause the draft before returning to setup')
  }

  const db = getDb()
  const patch: Partial<typeof eventLiveDrafts.$inferInsert> = {
    status,
    updatedAt: new Date(),
  }
  if (status === 'complete') {
    patch.completedAt = new Date()
  }
  const [row] = await db
    .update(eventLiveDrafts)
    .set(patch)
    .where(eq(eventLiveDrafts.id, draft.id))
    .returning()
  return mapLiveDraftRow(row)
}

async function getEventTeamNames(eventId: string): Promise<string[]> {
  const db = getDb()
  const [event] = await db
    .select({ teamNames: events.teamNames })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1)
  if (!event) throw new Error('Event not found')
  return (event.teamNames as string[]) ?? []
}

function pickByRegistrationId(
  picks: Array<{ pickIndex: number; registrationId: string | null }>
): Map<string, number> {
  const map = new Map<string, number>()
  for (const p of picks) {
    if (p.registrationId) map.set(p.registrationId, p.pickIndex)
  }
  return map
}

export async function buildCaptainDraftSnapshot(
  eventId: string,
  viewerEmail: string
): Promise<CaptainDraftSnapshot> {
  const db = getDb()
  const [event] = await db
    .select({ id: events.id, name: events.name })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1)
  if (!event) throw new Error('Event not found')

  const draft = await getLiveDraftByEventId(eventId)
  if (!draft) throw new Error('Live draft not configured')

  const registrations = await loadRegistrationRows(eventId)
  const teamNames = await getEventTeamNames(eventId)
  const normalizedViewer = normalizeEmail(viewerEmail)

  const captainReg = await resolveCaptainRegistration(eventId, normalizedViewer)
  const picks = await db
    .select({
      pickIndex: eventLiveDraftPicks.pickIndex,
      registrationId: eventLiveDraftPicks.registrationId,
    })
    .from(eventLiveDraftPicks)
    .where(eq(eventLiveDraftPicks.liveDraftId, draft.id))
    .orderBy(asc(eventLiveDraftPicks.pickIndex))

  const pickNumberByReg = pickByRegistrationId(picks)

  const pool = registrations
    .filter((r) => r.draftGroup == null)
    .map((r) =>
      mapToCaptainPoolPlayer({
        registrationId: r.id,
        nickname: r.nickname,
        firstName: r.firstName,
        lastName: r.lastName,
        gender: r.gender,
        skillLevel: r.skillLevel,
        photoUrl: r.photoUrl,
      })
    )

  const teamsByGroup = new Map<number, RegistrationRow[]>()
  for (const r of registrations) {
    if (r.draftGroup == null) continue
    const list = teamsByGroup.get(r.draftGroup) ?? []
    list.push(r)
    teamsByGroup.set(r.draftGroup, list)
  }

  const teamOrder =
    draft.teamOrder.length > 0 ? draft.teamOrder : [...teamsByGroup.keys()].sort((a, b) => a - b)

  const teams = teamOrder.map((draftGroup) => {
    const roster = teamsByGroup.get(draftGroup) ?? []
    const teamName = resolveTeamName(draftGroup, teamNames)
    const reqPlayers = roster.map((r) => ({
      gender: r.gender,
      skillLevel: r.skillLevel,
    }))
    const requirements = teamRequirementMeter(
      draftGroup,
      teamName,
      reqPlayers,
      draft.rules
    )
    return {
      draftGroup,
      teamName,
      requirements,
      players: roster.map((r) => ({
        ...mapToCaptainPoolPlayer({
          registrationId: r.id,
          nickname: r.nickname,
          firstName: r.firstName,
          lastName: r.lastName,
          gender: r.gender,
          skillLevel: r.skillLevel,
          photoUrl: r.photoUrl,
        }),
        pickNumber: pickNumberByReg.get(r.id) ?? null,
      })),
    }
  })

  const seq = draft.pickSequence
  const turn =
    draft.status === 'complete' || draft.currentPickIndex >= seq.length
      ? {
          pickIndex: draft.currentPickIndex,
          draftGroup: seq[seq.length - 1] ?? 0,
          teamName: resolveTeamName(seq[seq.length - 1] ?? 1, teamNames),
          isComplete: true,
        }
      : {
          pickIndex: draft.currentPickIndex,
          draftGroup: seq[draft.currentPickIndex],
          teamName: resolveTeamName(seq[draft.currentPickIndex], teamNames),
          isComplete: false,
        }

  const baseUrl =
    process.env.PLAYER_APP_BASE_URL?.trim().replace(/\/$/, '') ||
    'https://play-preview.bostondodgeballleague.com'

  const snapshot: CaptainDraftSnapshot = {
    version: 1,
    eventId: event.id,
    eventName: event.name,
    status: draft.status,
    viewer: {
      email: normalizedViewer,
      draftGroup: captainReg?.draftGroup ?? null,
      isCaptain: captainReg != null,
    },
    turn,
    pool,
    teams,
    rules: draft.rules,
    playDraftUrl: `${baseUrl}/drafts/${event.id}`,
  }

  assertCaptainDraftPayload(snapshot)
  return snapshot
}

export async function resolveCaptainRegistration(
  eventId: string,
  email: string
): Promise<{ registrationId: string; draftGroup: number } | null> {
  const db = getDb()
  const normalized = normalizeEmail(email)
  const emailRows = await db
    .select({ playerId: playerEmails.playerId })
    .from(playerEmails)
    .where(eq(playerEmails.email, normalized))

  const playerIds = emailRows.map((r) => r.playerId)
  if (playerIds.length === 0) return null

  const [captain] = await db
    .select({
      id: eventRegistrations.id,
      draftGroup: eventRegistrations.draftGroup,
    })
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.eventId, eventId),
        eq(eventRegistrations.isCaptain, true),
        inArray(eventRegistrations.playerId, playerIds)
      )
    )
    .limit(1)

  if (!captain || captain.draftGroup == null) return null
  return { registrationId: captain.id, draftGroup: captain.draftGroup }
}

export type MakeLiveDraftPickInput = {
  registrationId: string
  pickedBy: 'captain' | 'board'
  actor: string
  /** When set, captain must be on this draft group (turn enforcement). */
  expectedDraftGroup?: number
}

export async function makeLiveDraftPick(
  eventId: string,
  input: MakeLiveDraftPickInput
): Promise<LiveDraftRecord> {
  const draft = await getLiveDraftByEventId(eventId)
  if (!draft) throw new Error('Live draft not configured')
  if (draft.status !== 'live') throw new Error('Draft is not live')

  const pickIndex = draft.currentPickIndex
  const seq = draft.pickSequence
  if (pickIndex >= seq.length) throw new Error('Draft is complete')

  const slotGroup = seq[pickIndex]
  if (input.expectedDraftGroup != null && input.expectedDraftGroup !== slotGroup) {
    throw new Error('Not your turn')
  }
  if (input.pickedBy === 'captain') {
    const captain = await resolveCaptainRegistration(eventId, input.actor)
    if (!captain || captain.draftGroup !== slotGroup) {
      throw new Error('Only the on-the-clock captain can pick')
    }
  }

  const db = getDb()
  const [registration] = await db
    .select({
      id: eventRegistrations.id,
      draftGroup: eventRegistrations.draftGroup,
      teamLocked: eventRegistrations.teamLocked,
    })
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.id, input.registrationId),
        eq(eventRegistrations.eventId, eventId)
      )
    )
    .limit(1)

  if (!registration) throw new Error('Registration not found')
  if (registration.draftGroup != null) throw new Error('Player is already drafted')
  if (registration.teamLocked) throw new Error('Locked signup players are not in the pool')

  const now = new Date()

  await db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ currentPickIndex: eventLiveDrafts.currentPickIndex, status: eventLiveDrafts.status })
      .from(eventLiveDrafts)
      .where(
        and(
          eq(eventLiveDrafts.id, draft.id),
          eq(eventLiveDrafts.currentPickIndex, pickIndex),
          eq(eventLiveDrafts.status, 'live')
        )
      )
      .limit(1)
    if (!locked) throw new Error('Pick slot was taken or draft state changed')

    await tx.insert(eventLiveDraftPicks).values({
      liveDraftId: draft.id,
      pickIndex,
      draftGroup: slotGroup,
      registrationId: input.registrationId,
      pickedBy: input.pickedBy,
      actor: input.actor,
    })

    await tx
      .update(eventRegistrations)
      .set({ draftGroup: slotGroup, updatedAt: now })
      .where(eq(eventRegistrations.id, input.registrationId))

    const nextIndex = pickIndex + 1
    const isComplete = nextIndex >= seq.length
    await tx
      .update(eventLiveDrafts)
      .set({
        currentPickIndex: nextIndex,
        status: isComplete ? 'complete' : 'live',
        completedAt: isComplete ? now : null,
        updatedAt: now,
      })
      .where(eq(eventLiveDrafts.id, draft.id))
  })

  const updated = await getLiveDraftByEventId(eventId)
  if (!updated) throw new Error('Live draft not found')
  return updated
}

export async function skipLiveDraftPick(
  eventId: string,
  actor: string
): Promise<LiveDraftRecord> {
  const draft = await getLiveDraftByEventId(eventId)
  if (!draft) throw new Error('Live draft not configured')
  if (draft.status !== 'live') throw new Error('Draft is not live')

  const pickIndex = draft.currentPickIndex
  const seq = draft.pickSequence
  if (pickIndex >= seq.length) throw new Error('Draft is complete')

  const slotGroup = seq[pickIndex]
  const now = new Date()

  const db = getDb()
  await db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ currentPickIndex: eventLiveDrafts.currentPickIndex })
      .from(eventLiveDrafts)
      .where(
        and(
          eq(eventLiveDrafts.id, draft.id),
          eq(eventLiveDrafts.currentPickIndex, pickIndex),
          eq(eventLiveDrafts.status, 'live')
        )
      )
      .limit(1)
    if (!locked) throw new Error('Pick slot was taken or draft state changed')

    await tx.insert(eventLiveDraftPicks).values({
      liveDraftId: draft.id,
      pickIndex,
      draftGroup: slotGroup,
      registrationId: null,
      pickedBy: 'skip',
      actor,
    })

    const nextIndex = pickIndex + 1
    const isComplete = nextIndex >= seq.length
    await tx
      .update(eventLiveDrafts)
      .set({
        currentPickIndex: nextIndex,
        status: isComplete ? 'complete' : 'live',
        completedAt: isComplete ? now : null,
        updatedAt: now,
      })
      .where(eq(eventLiveDrafts.id, draft.id))
  })

  const updated = await getLiveDraftByEventId(eventId)
  if (!updated) throw new Error('Live draft not found')
  return updated
}

export async function undoLiveDraftPick(eventId: string): Promise<LiveDraftRecord> {
  const draft = await getLiveDraftByEventId(eventId)
  if (!draft) throw new Error('Live draft not configured')

  const db = getDb()
  const [lastPick] = await db
    .select()
    .from(eventLiveDraftPicks)
    .where(eq(eventLiveDraftPicks.liveDraftId, draft.id))
    .orderBy(sql`${eventLiveDraftPicks.pickIndex} desc`)
    .limit(1)

  if (!lastPick) throw new Error('No picks to undo')

  const now = new Date()
  await db.transaction(async (tx) => {
    if (lastPick.registrationId) {
      await tx
        .update(eventRegistrations)
        .set({ draftGroup: null, updatedAt: now })
        .where(eq(eventRegistrations.id, lastPick.registrationId))
    }
    await tx.delete(eventLiveDraftPicks).where(eq(eventLiveDraftPicks.id, lastPick.id))
    await tx
      .update(eventLiveDrafts)
      .set({
        currentPickIndex: lastPick.pickIndex,
        status: 'live',
        completedAt: null,
        updatedAt: now,
      })
      .where(eq(eventLiveDrafts.id, draft.id))
  })

  const updated = await getLiveDraftByEventId(eventId)
  if (!updated) throw new Error('Live draft not found')
  return updated
}

export async function listCaptainLiveDraftEvents(email: string): Promise<
  Array<{ eventId: string; eventName: string; eventDate: string; status: LiveDraftStatus }>
> {
  const db = getDb()
  const normalized = normalizeEmail(email)
  const emailRows = await db
    .select({ playerId: playerEmails.playerId })
    .from(playerEmails)
    .where(eq(playerEmails.email, normalized))
  const playerIds = emailRows.map((r) => r.playerId)
  if (playerIds.length === 0) return []

  const captainRegs = await db
    .select({ eventId: eventRegistrations.eventId })
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.isCaptain, true),
        inArray(eventRegistrations.playerId, playerIds)
      )
    )

  const eventIds = [...new Set(captainRegs.map((r) => r.eventId))]
  if (eventIds.length === 0) return []

  const rows = await db
    .select({
      eventId: events.id,
      eventName: events.name,
      eventDate: events.eventDate,
      status: eventLiveDrafts.status,
    })
    .from(events)
    .innerJoin(eventLiveDrafts, eq(eventLiveDrafts.eventId, events.id))
    .where(inArray(events.id, eventIds))
    .orderBy(asc(events.eventDate))

  return rows.map((r) => ({
    eventId: r.eventId,
    eventName: r.eventName,
    eventDate: r.eventDate,
    status: r.status as LiveDraftStatus,
  }))
}

export function poolPhotoCoverage(registrations: RegistrationRow[]): {
  withPhoto: number
  total: number
} {
  const pool = registrations.filter((r) => r.draftGroup == null)
  const withPhoto = pool.filter((r) => r.photoUrl).length
  return { withPhoto, total: pool.length }
}

export async function getLiveDraftCommissionerView(eventId: string) {
  const draft = await ensureLiveDraft(eventId)
  const registrations = await loadRegistrationRows(eventId)
  const snapshot = await buildCaptainDraftSnapshot(eventId, 'commissioner@internal')
  const photos = poolPhotoCoverage(registrations)
  return {
    draft,
    snapshot,
    photoCoverage: photos,
    registrations: registrations.map((r) => ({
      id: r.id,
      nickname: r.nickname ?? '',
      firstName: r.firstName,
      lastName: r.lastName,
      hasStrongPersonality: r.hasStrongPersonality,
      strongPersonalityNotes: r.strongPersonalityNotes,
    })),
  }
}
