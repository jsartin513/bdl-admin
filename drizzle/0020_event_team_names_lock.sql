ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "team_names" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "teams_locked" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "teams_finalized_at" timestamp with time zone;
