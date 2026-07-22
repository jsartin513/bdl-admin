import {
  boolean,
  date,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'

export const players = pgTable(
  'players',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    firstName: text('first_name').notNull(),
    lastName: text('last_name').notNull(),
    rosterName: text('roster_name').notNull(),
    /** Null = default to first name + last initial until manually set. */
    nickname: text('nickname'),
    jerseyNumber: integer('jersey_number'),
    /** Null = default to last name until manually set. */
    jerseyName: text('jersey_name'),
    skillLevel: integer('skill_level'),
    /** Canonical: man | woman | nonbinary | other */
    gender: text('gender'),
    isMerged: boolean('is_merged').notNull().default(false),
    mergedIntoPlayerId: uuid('merged_into_player_id'),
    hasStrongPersonality: boolean('has_strong_personality').notNull().default(false),
    strongPersonalityNotes: text('strong_personality_notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('players_name_idx').on(table.firstName, table.lastName),
    index('players_is_merged_idx').on(table.isMerged),
  ]
)

export const playerEmails = pgTable(
  'player_emails',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    isPrimary: boolean('is_primary').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('player_emails_email_uidx').on(table.email)]
)

export const playerAliases = pgTable(
  'player_aliases',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    alias: text('alias').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('player_aliases_player_alias_uidx').on(table.playerId, table.alias),
  ]
)

export const playerHomeLeagues = pgTable(
  'player_home_leagues',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    homeLeague: text('home_league').notNull(),
    sortOrder: integer('sort_order').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('player_home_leagues_player_league_uidx').on(
      table.playerId,
      table.homeLeague
    ),
    index('player_home_leagues_player_sort_idx').on(table.playerId, table.sortOrder),
  ]
)

export const events = pgTable(
  'events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    eventDate: date('event_date').notNull(),
    /** Canonical: tournament | open_gym | other */
    eventType: text('event_type').notNull().default('tournament'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('events_event_date_idx').on(table.eventDate)]
)

export const importBatches = pgTable('import_batches', {
  id: uuid('id').defaultRandom().primaryKey(),
  filename: text('filename').notNull(),
  actor: text('actor').notNull(),
  rowCount: integer('row_count').notNull().default(0),
  summary: jsonb('summary').$type<Record<string, unknown>>().notNull().default({}),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const playerChanges = pgTable(
  'player_changes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    source: text('source').notNull(),
    actor: text('actor').notNull(),
    before: jsonb('before').$type<Record<string, unknown> | null>(),
    after: jsonb('after').$type<Record<string, unknown> | null>(),
    changeType: text('change_type').notNull(),
    importBatchId: uuid('import_batch_id').references(() => importBatches.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('player_changes_player_id_idx').on(table.playerId)]
)

export const eventRegistrations = pgTable(
  'event_registrations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    /** Canonical for v1: registered (room for attended/cancelled later) */
    status: text('status').notNull().default('registered'),
    /** Positive int draft bucket; null = unassigned */
    draftGroup: integer('draft_group'),
    isCaptain: boolean('is_captain').notNull().default(false),
    /** Shared UUID links two registrations as a pair; null = unpaired */
    pairId: uuid('pair_id'),
    importBatchId: uuid('import_batch_id').references(() => importBatches.id, {
      onDelete: 'set null',
    }),
    registeredAt: timestamp('registered_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('event_registrations_event_player_uidx').on(table.eventId, table.playerId),
    index('event_registrations_event_id_idx').on(table.eventId),
    index('event_registrations_player_id_idx').on(table.playerId),
    index('event_registrations_event_pair_id_idx').on(table.eventId, table.pairId),
  ]
)

export const eventDraftSnapshots = pgTable(
  'event_draft_snapshots',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => events.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** Map of registrationId → draftGroup (number) or null */
    assignments: jsonb('assignments')
      .$type<Record<string, number | null>>()
      .notNull()
      .default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('event_draft_snapshots_event_id_idx').on(table.eventId)]
)
