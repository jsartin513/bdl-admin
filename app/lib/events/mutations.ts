import { and, asc, eq, inArray } from 'drizzle-orm'
import { randomUUID } from 'crypto'
import { getDb } from '@/app/lib/db'
import {
  eventDraftSnapshots,
  eventRegistrations,
  events,
} from '@/app/db/schema'
import {
  isValidEventType,
  parseDraftGroup,
  type EventDraftSnapshotListItem,
  type EventRecord,
  type EventType,
} from '@/app/lib/events/types'

export function parseEventDate(value: string): string {
  const trimmed = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error('eventDate must be YYYY-MM-DD')
  }
  const d = new Date(`${trimmed}T00:00:00.000Z`)
  if (Number.isNaN(d.getTime())) {
    throw new Error('eventDate is not a valid date')
  }
  // Reject overflow dates that Date normalizes (e.g. 2026-02-31 → March)
  if (d.toISOString().slice(0, 10) !== trimmed) {
    throw new Error('eventDate is not a valid date')
  }
  return trimmed
}

export async function createEvent(input: {
  name: string
  eventDate: string
  eventType?: string | null
  notes?: string | null
  pairingEnabled?: boolean
}): Promise<EventRecord> {
  const db = getDb()
  const name = input.name.trim()
  if (!name) throw new Error('name is required')

  const eventDate = parseEventDate(input.eventDate)
  let eventType: EventType = 'tournament'
  if (input.eventType != null && input.eventType !== '') {
    if (!isValidEventType(input.eventType)) throw new Error('Invalid eventType')
    eventType = input.eventType
  }

  const notes = input.notes?.trim() ? input.notes.trim() : null
  const pairingEnabled = input.pairingEnabled !== false

  const [created] = await db
    .insert(events)
    .values({ name, eventDate, eventType, notes, pairingEnabled })
    .returning()

  return created
}

export async function updateEvent(
  id: string,
  patch: {
    name?: string
    eventDate?: string
    eventType?: string | null
    notes?: string | null
    pairingEnabled?: boolean
  }
): Promise<EventRecord> {
  const db = getDb()
  const updates: {
    name?: string
    eventDate?: string
    eventType?: string
    notes?: string | null
    pairingEnabled?: boolean
    updatedAt: Date
  } = { updatedAt: new Date() }

  if (patch.name !== undefined) {
    const name = patch.name.trim()
    if (!name) throw new Error('name is required')
    updates.name = name
  }
  if (patch.eventDate !== undefined) {
    updates.eventDate = parseEventDate(patch.eventDate)
  }
  if (patch.eventType !== undefined) {
    if (patch.eventType == null || patch.eventType === '') {
      updates.eventType = 'tournament'
    } else if (!isValidEventType(patch.eventType)) {
      throw new Error('Invalid eventType')
    } else {
      updates.eventType = patch.eventType
    }
  }
  if (patch.notes !== undefined) {
    updates.notes = patch.notes?.trim() ? patch.notes.trim() : null
  }
  if (patch.pairingEnabled !== undefined) {
    updates.pairingEnabled = Boolean(patch.pairingEnabled)
  }

  const [updated] = await db
    .update(events)
    .set(updates)
    .where(eq(events.id, id))
    .returning()

  if (!updated) throw new Error('Event not found')
  return updated
}

export async function deleteEvent(id: string): Promise<void> {
  const db = getDb()
  const deleted = await db.delete(events).where(eq(events.id, id)).returning({ id: events.id })
  if (deleted.length === 0) throw new Error('Event not found')
}

/**
 * Create registration if missing; if present only refresh importBatchId / updatedAt.
 * Never clears draftGroup.
 */
export async function upsertEventRegistration(input: {
  eventId: string
  playerId: string
  importBatchId?: string | null
}): Promise<{ created: boolean; id: string }> {
  const db = getDb()
  const [existing] = await db
    .select({
      id: eventRegistrations.id,
    })
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.eventId, input.eventId),
        eq(eventRegistrations.playerId, input.playerId)
      )
    )
    .limit(1)

  if (existing) {
    // Do not touch draftGroup on re-import
    await db
      .update(eventRegistrations)
      .set({
        importBatchId: input.importBatchId ?? null,
        updatedAt: new Date(),
      })
      .where(eq(eventRegistrations.id, existing.id))
    return { created: false, id: existing.id }
  }

  const [created] = await db
    .insert(eventRegistrations)
    .values({
      eventId: input.eventId,
      playerId: input.playerId,
      status: 'registered',
      draftGroup: null,
      importBatchId: input.importBatchId ?? null,
    })
    .returning({ id: eventRegistrations.id })

  return { created: true, id: created.id }
}

export async function updateRegistrationDraftGroup(
  eventId: string,
  registrationId: string,
  draftGroupInput: unknown
): Promise<{ id: string; draftGroup: number | null; isCaptain: boolean }> {
  const draftGroup = parseDraftGroup(draftGroupInput)
  if (draftGroup === undefined) {
    throw new Error('draftGroup is required')
  }

  const db = getDb()
  const [updated] = await db
    .update(eventRegistrations)
    .set({
      draftGroup,
      // Captains only apply to players on a team
      ...(draftGroup == null ? { isCaptain: false } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(eventRegistrations.id, registrationId),
        eq(eventRegistrations.eventId, eventId)
      )
    )
    .returning({
      id: eventRegistrations.id,
      draftGroup: eventRegistrations.draftGroup,
      isCaptain: eventRegistrations.isCaptain,
    })

  if (!updated) throw new Error('Registration not found')
  return updated
}

export async function updateRegistrationCaptain(
  eventId: string,
  registrationId: string,
  isCaptain: boolean
): Promise<{ id: string; isCaptain: boolean; draftGroup: number | null }> {
  const db = getDb()
  const [existing] = await db
    .select({
      id: eventRegistrations.id,
      draftGroup: eventRegistrations.draftGroup,
    })
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.id, registrationId),
        eq(eventRegistrations.eventId, eventId)
      )
    )
    .limit(1)

  if (!existing) throw new Error('Registration not found')
  if (isCaptain && existing.draftGroup == null) {
    throw new Error('Only players on a team can be captains')
  }

  const [updated] = await db
    .update(eventRegistrations)
    .set({ isCaptain, updatedAt: new Date() })
    .where(
      and(
        eq(eventRegistrations.id, registrationId),
        eq(eventRegistrations.eventId, eventId)
      )
    )
    .returning({
      id: eventRegistrations.id,
      isCaptain: eventRegistrations.isCaptain,
      draftGroup: eventRegistrations.draftGroup,
    })

  if (!updated) throw new Error('Registration not found')
  return updated
}

async function assertPairingEnabled(eventId: string): Promise<void> {
  const db = getDb()
  const [event] = await db
    .select({ pairingEnabled: events.pairingEnabled })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1)
  if (!event) throw new Error('Event not found')
  if (!event.pairingEnabled) {
    throw new Error('Pairing is disabled for this event')
  }
}

export async function pairRegistrations(
  eventId: string,
  registrationIdA: string,
  registrationIdB: string
): Promise<{ pairId: string; registrationIds: [string, string] }> {
  if (registrationIdA === registrationIdB) {
    throw new Error('Cannot pair a registration with itself')
  }

  await assertPairingEnabled(eventId)

  const db = getDb()
  const rows = await db
    .select({
      id: eventRegistrations.id,
      pairId: eventRegistrations.pairId,
    })
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.eventId, eventId),
        inArray(eventRegistrations.id, [registrationIdA, registrationIdB])
      )
    )

  if (rows.length !== 2) throw new Error('Registration not found')
  for (const row of rows) {
    if (row.pairId != null) {
      throw new Error('Registration is already paired')
    }
  }

  const pairId = randomUUID()
  const now = new Date()
  await db
    .update(eventRegistrations)
    .set({ pairId, updatedAt: now })
    .where(
      and(
        eq(eventRegistrations.eventId, eventId),
        inArray(eventRegistrations.id, [registrationIdA, registrationIdB])
      )
    )

  return { pairId, registrationIds: [registrationIdA, registrationIdB] }
}

export async function unpairRegistration(
  eventId: string,
  registrationId: string
): Promise<{ clearedPairId: string | null; registrationIds: string[] }> {
  await assertPairingEnabled(eventId)

  const db = getDb()
  const [row] = await db
    .select({
      id: eventRegistrations.id,
      pairId: eventRegistrations.pairId,
    })
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.id, registrationId),
        eq(eventRegistrations.eventId, eventId)
      )
    )
    .limit(1)

  if (!row) throw new Error('Registration not found')
  if (row.pairId == null) {
    return { clearedPairId: null, registrationIds: [row.id] }
  }

  const members = await db
    .select({ id: eventRegistrations.id })
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.eventId, eventId),
        eq(eventRegistrations.pairId, row.pairId)
      )
    )

  const ids = members.map((m) => m.id)
  await db
    .update(eventRegistrations)
    .set({ pairId: null, updatedAt: new Date() })
    .where(
      and(
        eq(eventRegistrations.eventId, eventId),
        inArray(eventRegistrations.id, ids)
      )
    )

  return { clearedPairId: row.pairId, registrationIds: ids }
}

function parseSnapshotAssignments(
  value: unknown
): Record<string, number | null> {
  if (value == null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('assignments must be an object')
  }
  const result: Record<string, number | null> = {}
  for (const [registrationId, draftGroup] of Object.entries(
    value as Record<string, unknown>
  )) {
    if (!registrationId) throw new Error('registrationId is required')
    const parsed = parseDraftGroup(draftGroup)
    if (parsed === undefined) {
      throw new Error('draftGroup is required for each assignment')
    }
    result[registrationId] = parsed
  }
  return result
}

export async function listEventDraftSnapshots(
  eventId: string
): Promise<EventDraftSnapshotListItem[]> {
  const db = getDb()
  const rows = await db
    .select()
    .from(eventDraftSnapshots)
    .where(eq(eventDraftSnapshots.eventId, eventId))
    .orderBy(asc(eventDraftSnapshots.createdAt))

  return rows.map((r) => ({
    id: r.id,
    eventId: r.eventId,
    name: r.name,
    assignments: r.assignments ?? {},
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }))
}

export async function createEventDraftSnapshot(input: {
  eventId: string
  name: string
  assignments: unknown
}): Promise<EventDraftSnapshotListItem> {
  const name = input.name.trim()
  if (!name) throw new Error('name is required')
  const assignments = parseSnapshotAssignments(input.assignments)

  const db = getDb()
  const [created] = await db
    .insert(eventDraftSnapshots)
    .values({
      eventId: input.eventId,
      name,
      assignments,
    })
    .returning()

  return {
    id: created.id,
    eventId: created.eventId,
    name: created.name,
    assignments: created.assignments ?? {},
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  }
}

export async function renameEventDraftSnapshot(
  eventId: string,
  snapshotId: string,
  nameInput: string
): Promise<EventDraftSnapshotListItem> {
  const name = nameInput.trim()
  if (!name) throw new Error('name is required')

  const db = getDb()
  const [updated] = await db
    .update(eventDraftSnapshots)
    .set({ name, updatedAt: new Date() })
    .where(
      and(
        eq(eventDraftSnapshots.id, snapshotId),
        eq(eventDraftSnapshots.eventId, eventId)
      )
    )
    .returning()

  if (!updated) throw new Error('Snapshot not found')
  return {
    id: updated.id,
    eventId: updated.eventId,
    name: updated.name,
    assignments: updated.assignments ?? {},
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  }
}

export async function deleteEventDraftSnapshot(
  eventId: string,
  snapshotId: string
): Promise<void> {
  const db = getDb()
  const deleted = await db
    .delete(eventDraftSnapshots)
    .where(
      and(
        eq(eventDraftSnapshots.id, snapshotId),
        eq(eventDraftSnapshots.eventId, eventId)
      )
    )
    .returning({ id: eventDraftSnapshots.id })

  if (deleted.length === 0) throw new Error('Snapshot not found')
}

export async function getEventDraftSnapshot(
  eventId: string,
  snapshotId: string
): Promise<EventDraftSnapshotListItem | null> {
  const db = getDb()
  const [row] = await db
    .select()
    .from(eventDraftSnapshots)
    .where(
      and(
        eq(eventDraftSnapshots.id, snapshotId),
        eq(eventDraftSnapshots.eventId, eventId)
      )
    )
    .limit(1)
  if (!row) return null
  return {
    id: row.id,
    eventId: row.eventId,
    name: row.name,
    assignments: row.assignments ?? {},
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

export async function promoteEventDraftSnapshot(
  eventId: string,
  snapshotId: string
): Promise<Array<{ id: string; draftGroup: number | null }>> {
  const snapshot = await getEventDraftSnapshot(eventId, snapshotId)
  if (!snapshot) throw new Error('Snapshot not found')

  const assignments = Object.entries(snapshot.assignments).map(
    ([registrationId, draftGroup]) => ({ registrationId, draftGroup })
  )
  return bulkUpdateRegistrationDraftGroups(eventId, assignments)
}

export async function deleteEventRegistration(
  eventId: string,
  registrationId: string
): Promise<void> {
  const db = getDb()
  const deleted = await db
    .delete(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.id, registrationId),
        eq(eventRegistrations.eventId, eventId)
      )
    )
    .returning({ id: eventRegistrations.id })

  if (deleted.length === 0) throw new Error('Registration not found')
}

export async function bulkUpdateRegistrationDraftGroups(
  eventId: string,
  assignments: Array<{ registrationId: string; draftGroup: number | null }>
): Promise<Array<{ id: string; draftGroup: number | null }>> {
  if (assignments.length === 0) return []

  const parsed = assignments.map((a) => {
    const draftGroup = parseDraftGroup(a.draftGroup)
    if (draftGroup === undefined) {
      throw new Error('draftGroup is required for each assignment')
    }
    if (!a.registrationId || typeof a.registrationId !== 'string') {
      throw new Error('registrationId is required for each assignment')
    }
    return { registrationId: a.registrationId, draftGroup }
  })

  const db = getDb()
  const ids = parsed.map((p) => p.registrationId)
  const existing = await db
    .select({ id: eventRegistrations.id })
    .from(eventRegistrations)
    .where(
      and(
        eq(eventRegistrations.eventId, eventId),
        inArray(eventRegistrations.id, ids)
      )
    )
  const existingIds = new Set(existing.map((row) => row.id))
  for (const registrationId of ids) {
    if (!existingIds.has(registrationId)) {
      throw new Error(`Registration not found: ${registrationId}`)
    }
  }

  // Neon HTTP has no multi-statement transactions; preflight above avoids
  // partial applies from missing/mismatched IDs before any writes.
  const now = new Date()
  const results: Array<{ id: string; draftGroup: number | null }> = []

  for (const { registrationId, draftGroup } of parsed) {
    const [updated] = await db
      .update(eventRegistrations)
      .set({
        draftGroup,
        ...(draftGroup == null ? { isCaptain: false } : {}),
        updatedAt: now,
      })
      .where(
        and(
          eq(eventRegistrations.id, registrationId),
          eq(eventRegistrations.eventId, eventId)
        )
      )
      .returning({
        id: eventRegistrations.id,
        draftGroup: eventRegistrations.draftGroup,
      })

    if (!updated) {
      throw new Error(`Registration not found: ${registrationId}`)
    }
    results.push(updated)
  }

  return results
}
