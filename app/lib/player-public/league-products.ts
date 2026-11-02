import { asc, desc, eq } from 'drizzle-orm'
import { events } from '@/app/db/schema'
import { getDb, isDatabaseConfigured } from '@/app/lib/db'
import { PUBLIC_LEAGUE_FORBIDDEN_KEYS } from '@/app/lib/player-public/leagues'

/** Allowlisted fields for sellable league products (`products` on the public catalog). */
export const PUBLIC_LEAGUE_PRODUCT_FIELD_KEYS = [
  'id',
  'name',
  'startDate',
  'endDate',
  'time',
  'location',
  'format',
  'priceCents',
  'capacity',
  'registrationOpensAt',
  'registrationClosesAt',
  'publicDescription',
] as const

export type PublicLeagueProductFieldKey = (typeof PUBLIC_LEAGUE_PRODUCT_FIELD_KEYS)[number]

export type PublicLeagueProduct = {
  id: string
  name: string
  startDate: string
  endDate: string | null
  time: string | null
  location: string | null
  format: string | null
  priceCents: number | null
  capacity: number | null
  registrationOpensAt: string | null
  registrationClosesAt: string | null
  publicDescription: string | null
}

/** Extra keys that must never appear on public product payloads. */
export const PUBLIC_LEAGUE_PRODUCT_FORBIDDEN_KEYS = [
  ...PUBLIC_LEAGUE_FORBIDDEN_KEYS,
  'notes',
  'teamNames',
  'team_names',
  'teamsLocked',
  'teams_locked',
  'teamsFinalizedAt',
  'teams_finalized_at',
  'pairingEnabled',
  'pairing_enabled',
  'ballType',
  'ball_type',
  'gender',
  'eventType',
  'event_type',
  'eventDate',
  'event_date',
  'eventFormat',
  'event_format',
  'publishedToPlayerApp',
  'published_to_player_app',
  'sessionTimeLabel',
  'session_time_label',
  'createdAt',
  'created_at',
  'updatedAt',
  'updated_at',
] as const

type EventProductRow = Pick<
  typeof events.$inferSelect,
  | 'id'
  | 'name'
  | 'eventDate'
  | 'eventEndDate'
  | 'sessionTimeLabel'
  | 'location'
  | 'eventFormat'
  | 'priceCents'
  | 'capacity'
  | 'registrationOpensAt'
  | 'registrationClosesAt'
  | 'publicDescription'
>

export function mapEventRowToPublicLeagueProduct(row: EventProductRow): PublicLeagueProduct {
  return {
    id: row.id,
    name: row.name,
    startDate: row.eventDate,
    endDate: row.eventEndDate ?? null,
    time: row.sessionTimeLabel ?? null,
    location: row.location ?? null,
    format: row.eventFormat ?? null,
    priceCents: row.priceCents ?? null,
    capacity: row.capacity ?? null,
    registrationOpensAt: row.registrationOpensAt?.toISOString() ?? null,
    registrationClosesAt: row.registrationClosesAt?.toISOString() ?? null,
    publicDescription: row.publicDescription ?? null,
  }
}

export async function listPublicLeagueProducts(): Promise<PublicLeagueProduct[]> {
  if (!isDatabaseConfigured()) {
    return []
  }
  const db = getDb()
  const rows = await db
    .select({
      id: events.id,
      name: events.name,
      eventDate: events.eventDate,
      eventEndDate: events.eventEndDate,
      sessionTimeLabel: events.sessionTimeLabel,
      location: events.location,
      eventFormat: events.eventFormat,
      priceCents: events.priceCents,
      capacity: events.capacity,
      registrationOpensAt: events.registrationOpensAt,
      registrationClosesAt: events.registrationClosesAt,
      publicDescription: events.publicDescription,
    })
    .from(events)
    .where(eq(events.publishedToPlayerApp, true))
    .orderBy(desc(events.eventDate), asc(events.name))

  return rows.map(mapEventRowToPublicLeagueProduct)
}

export function assertPublicLeagueProductPayload(value: unknown): void {
  const forbidden = new Set<string>([
    ...PUBLIC_LEAGUE_FORBIDDEN_KEYS,
    ...PUBLIC_LEAGUE_PRODUCT_FORBIDDEN_KEYS,
  ])
  const walk = (node: unknown, path: string) => {
    if (node === null || typeof node !== 'object') return
    if (Array.isArray(node)) {
      node.forEach((item, i) => walk(item, `${path}[${i}]`))
      return
    }
    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      if (forbidden.has(key)) {
        throw new Error(`Forbidden public league product key "${key}" at ${path || 'root'}`)
      }
      walk(child, path ? `${path}.${key}` : key)
    }
  }
  walk(value, '')
}
