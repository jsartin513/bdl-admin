import { and, eq } from 'drizzle-orm'
import { getDb } from '@/app/lib/db'
import { eventRegistrations, events } from '@/app/db/schema'
import {
  isValidEventType,
  parseDraftGroup,
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

  const [created] = await db
    .insert(events)
    .values({ name, eventDate, eventType, notes })
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
  }
): Promise<EventRecord> {
  const db = getDb()
  const updates: {
    name?: string
    eventDate?: string
    eventType?: string
    notes?: string | null
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

  const [updated] = await db
    .update(events)
    .set(updates)
    .where(eq(events.id, id))
    .returning()

  if (!updated) throw new Error('Event not found')
  return updated
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
): Promise<{ id: string; draftGroup: number | null }> {
  const draftGroup = parseDraftGroup(draftGroupInput)
  if (draftGroup === undefined) {
    throw new Error('draftGroup is required')
  }

  const db = getDb()
  const [updated] = await db
    .update(eventRegistrations)
    .set({ draftGroup, updatedAt: new Date() })
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

  if (!updated) throw new Error('Registration not found')
  return updated
}
