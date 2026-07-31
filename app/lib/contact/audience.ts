import { asc, eq, inArray } from 'drizzle-orm'
import { getDb } from '@/app/lib/db'
import {
  playerEmails,
  playerMessagingPrefs,
  playerPhones,
  players,
} from '@/app/db/schema'
import { listPlayers } from '@/app/lib/players/queries'
import { getEvent } from '@/app/lib/events/queries'
import type {
  ContactAudienceInput,
  ContactChannel,
  ContactPreviewResult,
  ContactSkipReason,
  ResolvedContactRecipient,
} from '@/app/lib/contact/types'

function countSkips(
  recipients: ResolvedContactRecipient[]
): Partial<Record<ContactSkipReason, number>> {
  const counts: Partial<Record<ContactSkipReason, number>> = {}
  for (const r of recipients) {
    if (r.status !== 'skipped' || !r.skipReason) continue
    counts[r.skipReason] = (counts[r.skipReason] ?? 0) + 1
  }
  return counts
}

async function resolvePlayerIds(audience: ContactAudienceInput): Promise<{
  playerIds: string[]
  eventId: string | null
  audienceSnapshot: Record<string, unknown>
}> {
  if (audience.audienceType === 'player_ids') {
    return {
      playerIds: audience.playerIds,
      eventId: audience.eventId ?? null,
      audienceSnapshot: {
        audienceType: 'player_ids',
        playerIds: audience.playerIds,
        eventId: audience.eventId ?? null,
      },
    }
  }

  const filters = audience.filters
  const listed = await listPlayers({
    q: filters.q,
    skill: filters.skill,
    homeLeague: filters.homeLeague,
    eventId: filters.eventId,
    includeMerged: filters.includeMerged ?? false,
  })
  return {
    playerIds: listed.map((p) => p.id),
    eventId: filters.eventId ?? null,
    audienceSnapshot: {
      audienceType: 'filter',
      filters,
    },
  }
}

type MessagingPrefRow = {
  playerId: string
  emailOptOutAt: Date | null
  smsOptInAt: Date | null
  smsOptOutAt: Date | null
  whatsappOptInAt: Date | null
  whatsappOptOutAt: Date | null
}

function canSendEmail(prefs: MessagingPrefRow | undefined): boolean {
  return !prefs?.emailOptOutAt
}

function canSendSms(prefs: MessagingPrefRow | undefined): boolean {
  if (!prefs?.smsOptInAt) return false
  if (prefs.smsOptOutAt && prefs.smsOptOutAt >= prefs.smsOptInAt) return false
  return true
}

function canSendWhatsApp(prefs: MessagingPrefRow | undefined): boolean {
  if (!prefs?.whatsappOptInAt) return false
  if (
    prefs.whatsappOptOutAt &&
    prefs.whatsappOptOutAt >= prefs.whatsappOptInAt
  ) {
    return false
  }
  return true
}

/**
 * Resolve audience to per-player contact points for a channel.
 * Skips merged players, missing addresses, and consent failures.
 */
export async function previewContactAudience(opts: {
  channel: ContactChannel
  audience: ContactAudienceInput
}): Promise<ContactPreviewResult & { eventId: string | null; audienceSnapshot: Record<string, unknown>; eventName: string | null; eventDate: string | null }> {
  const { playerIds, eventId, audienceSnapshot } = await resolvePlayerIds(
    opts.audience
  )

  let eventName: string | null = null
  let eventDate: string | null = null
  if (eventId) {
    const event = await getEvent(eventId)
    if (event) {
      eventName = event.name
      eventDate = event.eventDate
    }
  }

  if (playerIds.length === 0) {
    return {
      channel: opts.channel,
      total: 0,
      reachable: 0,
      skipped: 0,
      skippedByReason: {},
      sample: [],
      recipients: [],
      eventId,
      audienceSnapshot,
      eventName,
      eventDate,
    }
  }

  const db = getDb()
  const playerRows = await db
    .select({
      id: players.id,
      firstName: players.firstName,
      lastName: players.lastName,
      rosterName: players.rosterName,
      isMerged: players.isMerged,
    })
    .from(players)
    .where(inArray(players.id, playerIds))
    .orderBy(asc(players.lastName), asc(players.firstName))

  const byId = new Map(playerRows.map((p) => [p.id, p]))
  // Preserve requested order for explicit ids; otherwise use DB name order
  const orderedIds =
    opts.audience.audienceType === 'player_ids'
      ? playerIds.filter((id) => byId.has(id))
      : playerRows.map((p) => p.id)

  const emails = await db
    .select()
    .from(playerEmails)
    .where(inArray(playerEmails.playerId, orderedIds))

  const phones = await db
    .select()
    .from(playerPhones)
    .where(inArray(playerPhones.playerId, orderedIds))

  const prefs = await db
    .select()
    .from(playerMessagingPrefs)
    .where(inArray(playerMessagingPrefs.playerId, orderedIds))

  const primaryEmail = new Map<string, string>()
  for (const e of emails) {
    if (e.isPrimary && !primaryEmail.has(e.playerId)) {
      primaryEmail.set(e.playerId, e.email)
    }
  }
  for (const e of emails) {
    if (!primaryEmail.has(e.playerId)) primaryEmail.set(e.playerId, e.email)
  }

  const primaryPhone = new Map<string, string>()
  for (const p of phones) {
    if (p.isPrimary && !primaryPhone.has(p.playerId)) {
      primaryPhone.set(p.playerId, p.phoneE164)
    }
  }
  for (const p of phones) {
    if (!primaryPhone.has(p.playerId)) primaryPhone.set(p.playerId, p.phoneE164)
  }

  const prefsByPlayer = new Map<string, MessagingPrefRow>()
  for (const p of prefs) {
    prefsByPlayer.set(p.playerId, p)
  }

  const recipients: ResolvedContactRecipient[] = []
  for (const id of orderedIds) {
    const player = byId.get(id)
    if (!player) continue

    if (player.isMerged) {
      recipients.push({
        playerId: id,
        firstName: player.firstName,
        lastName: player.lastName,
        rosterName: player.rosterName,
        address: null,
        status: 'skipped',
        skipReason: 'merged',
      })
      continue
    }

    const pref = prefsByPlayer.get(id)

    if (opts.channel === 'email') {
      if (!canSendEmail(pref)) {
        recipients.push({
          playerId: id,
          firstName: player.firstName,
          lastName: player.lastName,
          rosterName: player.rosterName,
          address: primaryEmail.get(id) ?? null,
          status: 'skipped',
          skipReason: 'opted_out',
        })
        continue
      }
      const address = primaryEmail.get(id) ?? null
      if (!address) {
        recipients.push({
          playerId: id,
          firstName: player.firstName,
          lastName: player.lastName,
          rosterName: player.rosterName,
          address: null,
          status: 'skipped',
          skipReason: 'no_email',
        })
        continue
      }
      recipients.push({
        playerId: id,
        firstName: player.firstName,
        lastName: player.lastName,
        rosterName: player.rosterName,
        address,
        status: 'reachable',
        skipReason: null,
      })
      continue
    }

    if (opts.channel === 'sms') {
      if (!canSendSms(pref)) {
        recipients.push({
          playerId: id,
          firstName: player.firstName,
          lastName: player.lastName,
          rosterName: player.rosterName,
          address: primaryPhone.get(id) ?? null,
          status: 'skipped',
          skipReason: pref?.smsOptOutAt ? 'opted_out' : 'no_opt_in',
        })
        continue
      }
      const address = primaryPhone.get(id) ?? null
      if (!address) {
        recipients.push({
          playerId: id,
          firstName: player.firstName,
          lastName: player.lastName,
          rosterName: player.rosterName,
          address: null,
          status: 'skipped',
          skipReason: 'no_phone',
        })
        continue
      }
      recipients.push({
        playerId: id,
        firstName: player.firstName,
        lastName: player.lastName,
        rosterName: player.rosterName,
        address,
        status: 'reachable',
        skipReason: null,
      })
      continue
    }

    // whatsapp
    if (!canSendWhatsApp(pref)) {
      recipients.push({
        playerId: id,
        firstName: player.firstName,
        lastName: player.lastName,
        rosterName: player.rosterName,
        address: primaryPhone.get(id) ?? null,
        status: 'skipped',
        skipReason: pref?.whatsappOptOutAt ? 'opted_out' : 'no_opt_in',
      })
      continue
    }
    const address = primaryPhone.get(id) ?? null
    if (!address) {
      recipients.push({
        playerId: id,
        firstName: player.firstName,
        lastName: player.lastName,
        rosterName: player.rosterName,
        address: null,
        status: 'skipped',
        skipReason: 'no_phone',
      })
      continue
    }
    recipients.push({
      playerId: id,
      firstName: player.firstName,
      lastName: player.lastName,
      rosterName: player.rosterName,
      address,
      status: 'reachable',
      skipReason: null,
    })
  }

  const reachable = recipients.filter((r) => r.status === 'reachable').length
  const skipped = recipients.length - reachable
  const skippedByReason = countSkips(recipients)

  return {
    channel: opts.channel,
    total: recipients.length,
    reachable,
    skipped,
    skippedByReason,
    sample: recipients.slice(0, 25),
    recipients,
    eventId,
    audienceSnapshot,
    eventName,
    eventDate,
  }
}

export async function getMessagingPrefsForPhone(
  phoneE164: string
): Promise<{ playerId: string } | null> {
  const db = getDb()
  const [phone] = await db
    .select({ playerId: playerPhones.playerId })
    .from(playerPhones)
    .where(eq(playerPhones.phoneE164, phoneE164))
    .limit(1)
  return phone ?? null
}

export async function upsertMessagingOptOut(opts: {
  playerId: string
  channel: 'sms' | 'whatsapp' | 'email'
}): Promise<void> {
  const db = getDb()
  const now = new Date()
  const [existing] = await db
    .select()
    .from(playerMessagingPrefs)
    .where(eq(playerMessagingPrefs.playerId, opts.playerId))
    .limit(1)

  const patch =
    opts.channel === 'sms'
      ? { smsOptOutAt: now, updatedAt: now }
      : opts.channel === 'whatsapp'
        ? { whatsappOptOutAt: now, updatedAt: now }
        : { emailOptOutAt: now, updatedAt: now }

  if (existing) {
    await db
      .update(playerMessagingPrefs)
      .set(patch)
      .where(eq(playerMessagingPrefs.playerId, opts.playerId))
    return
  }

  await db.insert(playerMessagingPrefs).values({
    playerId: opts.playerId,
    ...patch,
  })
}

/** Ensure prefs row exists (no-op upsert of empty prefs). */
export async function ensureMessagingPrefs(playerId: string) {
  const db = getDb()
  const [existing] = await db
    .select({ playerId: playerMessagingPrefs.playerId })
    .from(playerMessagingPrefs)
    .where(eq(playerMessagingPrefs.playerId, playerId))
    .limit(1)
  if (existing) return
  await db.insert(playerMessagingPrefs).values({ playerId })
}

export async function setMessagingOptIn(opts: {
  playerId: string
  channel: 'sms' | 'whatsapp'
  optedIn: boolean
}) {
  await ensureMessagingPrefs(opts.playerId)
  const db = getDb()
  const now = new Date()
  if (opts.channel === 'sms') {
    await db
      .update(playerMessagingPrefs)
      .set(
        opts.optedIn
          ? { smsOptInAt: now, smsOptOutAt: null, updatedAt: now }
          : { smsOptOutAt: now, updatedAt: now }
      )
      .where(eq(playerMessagingPrefs.playerId, opts.playerId))
  } else {
    await db
      .update(playerMessagingPrefs)
      .set(
        opts.optedIn
          ? { whatsappOptInAt: now, whatsappOptOutAt: null, updatedAt: now }
          : { whatsappOptOutAt: now, updatedAt: now }
      )
      .where(eq(playerMessagingPrefs.playerId, opts.playerId))
  }
}

export async function setEmailOptOut(opts: {
  playerId: string
  optedOut: boolean
}) {
  await ensureMessagingPrefs(opts.playerId)
  const db = getDb()
  const now = new Date()
  await db
    .update(playerMessagingPrefs)
    .set({
      emailOptOutAt: opts.optedOut ? now : null,
      updatedAt: now,
    })
    .where(eq(playerMessagingPrefs.playerId, opts.playerId))
}
