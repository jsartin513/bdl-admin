import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

export type SkillAreasJson = {
  offense: number | null
  defense: number | null
  stayingAlive: number | null
  courtPresence: number | null
} | null

/** Official board skill ratings (migrating off operational `players`). */
export const playerOfficialSkill = pgTable('player_official_skill', {
  playerId: uuid('player_id').primaryKey(),
  skillLevel: integer('skill_level'),
  skillLevelFib: integer('skill_level_fib'),
  skillAreas: jsonb('skill_areas').$type<SkillAreasJson>(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const playerPersonality = pgTable('player_personality', {
  playerId: uuid('player_id').primaryKey(),
  hasStrongPersonality: boolean('has_strong_personality').notNull().default(false),
  strongPersonalityNotes: text('strong_personality_notes'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const playerPersonNotes = pgTable(
  'player_person_notes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    playerId: uuid('player_id').notNull(),
    body: text('body').notNull(),
    actor: text('actor').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('player_person_notes_player_id_idx').on(table.playerId)]
)

/** Audit trail (migrating off operational `player_changes`). */
export const sensitivePlayerChanges = pgTable(
  'player_changes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    playerId: uuid('player_id').notNull(),
    source: text('source').notNull(),
    actor: text('actor').notNull(),
    before: jsonb('before').$type<Record<string, unknown> | null>(),
    after: jsonb('after').$type<Record<string, unknown> | null>(),
    changeType: text('change_type').notNull(),
    importBatchId: uuid('import_batch_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('player_changes_player_id_idx').on(table.playerId)]
)
