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
    /** Independent Fibonacci skill scale. */
    skillLevelFib: integer('skill_level_fib'),
    /**
     * Per-area skill scores on the linear scale.
     * Shape: { offense, defense, stayingAlive, courtPresence } each number | null.
     * Null fields fall back to skillLevel at read/score time.
     */
    skillAreas: jsonb('skill_areas').$type<{
      offense: number | null
      defense: number | null
      stayingAlive: number | null
      courtPresence: number | null
    } | null>(),
    /** Canonical: male | female | nonbinary | other */
    gender: text('gender'),
    /** Public Vercel Blob URL for profile headshot. */
    photoUrl: text('photo_url'),
    /** Blob pathname for delete/replace (e.g. player-photos/{id}/…). */
    photoPathname: text('photo_pathname'),
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
    /** Canonical: foam | cloth */
    ballType: text('ball_type').notNull().default('foam'),
    /** Canonical: mixed | open | she_they */
    gender: text('gender').notNull().default('mixed'),
    notes: text('notes'),
    /** When false, pair UI/behavior is disabled for the event */
    pairingEnabled: boolean('pairing_enabled').notNull().default(true),
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

/** External / travel events (not BDL-hosted). */
export const nonBdlEvents = pgTable(
  'non_bdl_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    eventDate: date('event_date').notNull(),
    /** Canonical: foam | cloth */
    ballType: text('ball_type').notNull().default('foam'),
    division: text('division'),
    city: text('city'),
    /** Optional HOME_LEAGUES code for known host orgs */
    hostOrgHomeLeague: text('host_org_home_league'),
    /** Free-text host org (required when no home-league code) */
    hostOrgName: text('host_org_name'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('non_bdl_events_event_date_idx').on(table.eventDate)]
)

export const nonBdlEventTeams = pgTable(
  'non_bdl_event_teams',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => nonBdlEvents.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** Free-text “how they did” */
    resultText: text('result_text'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('non_bdl_event_teams_event_id_idx').on(table.eventId)]
)

export const nonBdlEventAttendees = pgTable(
  'non_bdl_event_attendees',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => nonBdlEvents.id, { onDelete: 'cascade' }),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id').references(() => nonBdlEventTeams.id, {
      onDelete: 'set null',
    }),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('non_bdl_event_attendees_event_player_uidx').on(
      table.eventId,
      table.playerId
    ),
    index('non_bdl_event_attendees_event_id_idx').on(table.eventId),
    index('non_bdl_event_attendees_player_id_idx').on(table.playerId),
    index('non_bdl_event_attendees_team_id_idx').on(table.teamId),
  ]
)

export const nonBdlEventStories = pgTable(
  'non_bdl_event_stories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => nonBdlEvents.id, { onDelete: 'cascade' }),
    title: text('title'),
    body: text('body').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('non_bdl_event_stories_event_id_idx').on(table.eventId)]
)

export const nonBdlEventStoryTeamTags = pgTable(
  'non_bdl_event_story_team_tags',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storyId: uuid('story_id')
      .notNull()
      .references(() => nonBdlEventStories.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => nonBdlEventTeams.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('non_bdl_event_story_team_tags_uidx').on(table.storyId, table.teamId),
    index('non_bdl_event_story_team_tags_story_id_idx').on(table.storyId),
  ]
)

export const nonBdlEventStoryPlayerTags = pgTable(
  'non_bdl_event_story_player_tags',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storyId: uuid('story_id')
      .notNull()
      .references(() => nonBdlEventStories.id, { onDelete: 'cascade' }),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('non_bdl_event_story_player_tags_uidx').on(
      table.storyId,
      table.playerId
    ),
    index('non_bdl_event_story_player_tags_story_id_idx').on(table.storyId),
  ]
)

export const nonBdlEventPhotos = pgTable(
  'non_bdl_event_photos',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => nonBdlEvents.id, { onDelete: 'cascade' }),
    blobUrl: text('blob_url').notNull(),
    pathname: text('pathname').notNull(),
    caption: text('caption'),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('non_bdl_event_photos_event_id_idx').on(table.eventId)]
)

export const nonBdlEventPhotoTeamTags = pgTable(
  'non_bdl_event_photo_team_tags',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    photoId: uuid('photo_id')
      .notNull()
      .references(() => nonBdlEventPhotos.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => nonBdlEventTeams.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('non_bdl_event_photo_team_tags_uidx').on(table.photoId, table.teamId),
    index('non_bdl_event_photo_team_tags_photo_id_idx').on(table.photoId),
  ]
)

export const nonBdlEventPhotoPlayerTags = pgTable(
  'non_bdl_event_photo_player_tags',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    photoId: uuid('photo_id')
      .notNull()
      .references(() => nonBdlEventPhotos.id, { onDelete: 'cascade' }),
    playerId: uuid('player_id')
      .notNull()
      .references(() => players.id, { onDelete: 'cascade' }),
  },
  (table) => [
    uniqueIndex('non_bdl_event_photo_player_tags_uidx').on(
      table.photoId,
      table.playerId
    ),
    index('non_bdl_event_photo_player_tags_photo_id_idx').on(table.photoId),
  ]
)

/**
 * Concurrent GoPro upload/merge jobs for Video Tools.
 * Status: draft | uploading | ready | queued | processing | complete | failed
 */
export const videoUploadSets = pgTable(
  'video_upload_sets',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventName: text('event_name').notNull(),
    label: text('label').notNull(),
    eventDate: date('event_date').notNull(),
    status: text('status').notNull().default('draft'),
    createdByEmail: text('created_by_email').notNull(),
    errorMessage: text('error_message'),
    mergedBlobUrl: text('merged_blob_url'),
    mergedBlobPathname: text('merged_blob_pathname'),
    outputFilename: text('output_filename'),
    /** Rotated on each worker claim; invalidates stale complete/fail after retry. */
    claimToken: uuid('claim_token'),
    /** In-flight Blob upload tokens; Mark ready / enqueue require zero. */
    pendingUploadCount: integer('pending_upload_count').notNull().default(0),
    /** When true, mark ready + enqueue once pending uploads hit zero. */
    autoEnqueueOnReady: boolean('auto_enqueue_on_ready').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('video_upload_sets_status_idx').on(table.status),
    index('video_upload_sets_event_date_idx').on(table.eventDate),
    index('video_upload_sets_created_at_idx').on(table.createdAt),
  ]
)

/** In-app notifications for admins (e.g. video merge complete/fail). */
export const adminNotifications = pgTable(
  'admin_notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    recipientEmail: text('recipient_email').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    href: text('href'),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('admin_notifications_recipient_email_idx').on(table.recipientEmail),
    index('admin_notifications_created_at_idx').on(table.createdAt),
  ]
)

export const videoUploadClips = pgTable(
  'video_upload_clips',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    setId: uuid('set_id')
      .notNull()
      .references(() => videoUploadSets.id, { onDelete: 'cascade' }),
    originalFilename: text('original_filename').notNull(),
    blobUrl: text('blob_url').notNull(),
    pathname: text('pathname').notNull(),
    sizeBytes: integer('size_bytes').notNull().default(0),
    sortIndex: integer('sort_index'),
    uploadComplete: boolean('upload_complete').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('video_upload_clips_set_id_idx').on(table.setId),
    uniqueIndex('video_upload_clips_pathname_uidx').on(table.pathname),
  ]
)
