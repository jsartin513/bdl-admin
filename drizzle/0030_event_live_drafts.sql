CREATE TABLE IF NOT EXISTS "event_live_drafts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'setup',
  "order_type" text NOT NULL DEFAULT 'snake',
  "team_order" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "custom_slots" jsonb,
  "pick_sequence" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "current_pick_index" integer NOT NULL DEFAULT 0,
  "rules" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "started_at" timestamp with time zone,
  "completed_at" timestamp with time zone,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "event_live_drafts_event_id_uidx" ON "event_live_drafts" ("event_id");

CREATE TABLE IF NOT EXISTS "event_live_draft_picks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "live_draft_id" uuid NOT NULL REFERENCES "event_live_drafts"("id") ON DELETE CASCADE,
  "pick_index" integer NOT NULL,
  "draft_group" integer NOT NULL,
  "registration_id" uuid REFERENCES "event_registrations"("id") ON DELETE SET NULL,
  "picked_by" text NOT NULL,
  "actor" text NOT NULL,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "event_live_draft_picks_live_draft_pick_index_uidx"
  ON "event_live_draft_picks" ("live_draft_id", "pick_index");

CREATE INDEX IF NOT EXISTS "event_live_draft_picks_live_draft_id_idx"
  ON "event_live_draft_picks" ("live_draft_id");
