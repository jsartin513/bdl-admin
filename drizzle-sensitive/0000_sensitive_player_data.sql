CREATE TABLE IF NOT EXISTS "player_official_skill" (
	"player_id" uuid PRIMARY KEY NOT NULL,
	"skill_level" integer,
	"skill_level_fib" integer,
	"skill_areas" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "player_personality" (
	"player_id" uuid PRIMARY KEY NOT NULL,
	"has_strong_personality" boolean DEFAULT false NOT NULL,
	"strong_personality_notes" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "player_person_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"body" text NOT NULL,
	"actor" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_person_notes_player_id_idx" ON "player_person_notes" USING btree ("player_id");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "player_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"source" text NOT NULL,
	"actor" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"change_type" text NOT NULL,
	"import_batch_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_changes_player_id_idx" ON "player_changes" USING btree ("player_id");
