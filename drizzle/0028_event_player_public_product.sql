ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "published_to_player_app" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "public_description" text;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "location" text;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "event_end_date" date;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "session_time_label" text;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "price_cents" integer;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "capacity" integer;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "registration_opens_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "registration_closes_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "events_published_to_player_app_idx" ON "events" USING btree ("published_to_player_app");
