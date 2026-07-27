CREATE TABLE IF NOT EXISTS "non_bdl_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"event_date" date NOT NULL,
	"ball_type" text DEFAULT 'foam' NOT NULL,
	"division" text,
	"city" text,
	"host_org_home_league" text,
	"host_org_name" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "non_bdl_event_teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"name" text NOT NULL,
	"result_text" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "non_bdl_event_attendees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"team_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "non_bdl_event_stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"title" text,
	"body" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "non_bdl_event_story_team_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"team_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "non_bdl_event_story_player_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"player_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "non_bdl_event_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" uuid NOT NULL,
	"blob_url" text NOT NULL,
	"pathname" text NOT NULL,
	"caption" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "non_bdl_event_photo_team_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photo_id" uuid NOT NULL,
	"team_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "non_bdl_event_photo_player_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"photo_id" uuid NOT NULL,
	"player_id" uuid NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "non_bdl_event_teams" ADD CONSTRAINT "non_bdl_event_teams_event_id_non_bdl_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."non_bdl_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "non_bdl_event_attendees" ADD CONSTRAINT "non_bdl_event_attendees_event_id_non_bdl_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."non_bdl_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "non_bdl_event_attendees" ADD CONSTRAINT "non_bdl_event_attendees_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "non_bdl_event_attendees" ADD CONSTRAINT "non_bdl_event_attendees_team_id_non_bdl_event_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."non_bdl_event_teams"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "non_bdl_event_stories" ADD CONSTRAINT "non_bdl_event_stories_event_id_non_bdl_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."non_bdl_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "non_bdl_event_story_team_tags" ADD CONSTRAINT "non_bdl_event_story_team_tags_story_id_non_bdl_event_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."non_bdl_event_stories"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "non_bdl_event_story_team_tags" ADD CONSTRAINT "non_bdl_event_story_team_tags_team_id_non_bdl_event_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."non_bdl_event_teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "non_bdl_event_story_player_tags" ADD CONSTRAINT "non_bdl_event_story_player_tags_story_id_non_bdl_event_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."non_bdl_event_stories"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "non_bdl_event_story_player_tags" ADD CONSTRAINT "non_bdl_event_story_player_tags_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "non_bdl_event_photos" ADD CONSTRAINT "non_bdl_event_photos_event_id_non_bdl_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."non_bdl_events"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "non_bdl_event_photo_team_tags" ADD CONSTRAINT "non_bdl_event_photo_team_tags_photo_id_non_bdl_event_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."non_bdl_event_photos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "non_bdl_event_photo_team_tags" ADD CONSTRAINT "non_bdl_event_photo_team_tags_team_id_non_bdl_event_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."non_bdl_event_teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "non_bdl_event_photo_player_tags" ADD CONSTRAINT "non_bdl_event_photo_player_tags_photo_id_non_bdl_event_photos_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."non_bdl_event_photos"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "non_bdl_event_photo_player_tags" ADD CONSTRAINT "non_bdl_event_photo_player_tags_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "non_bdl_events_event_date_idx" ON "non_bdl_events" USING btree ("event_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "non_bdl_event_teams_event_id_idx" ON "non_bdl_event_teams" USING btree ("event_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "non_bdl_event_attendees_event_player_uidx" ON "non_bdl_event_attendees" USING btree ("event_id","player_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "non_bdl_event_attendees_event_id_idx" ON "non_bdl_event_attendees" USING btree ("event_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "non_bdl_event_attendees_player_id_idx" ON "non_bdl_event_attendees" USING btree ("player_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "non_bdl_event_attendees_team_id_idx" ON "non_bdl_event_attendees" USING btree ("team_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "non_bdl_event_stories_event_id_idx" ON "non_bdl_event_stories" USING btree ("event_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "non_bdl_event_story_team_tags_uidx" ON "non_bdl_event_story_team_tags" USING btree ("story_id","team_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "non_bdl_event_story_team_tags_story_id_idx" ON "non_bdl_event_story_team_tags" USING btree ("story_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "non_bdl_event_story_player_tags_uidx" ON "non_bdl_event_story_player_tags" USING btree ("story_id","player_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "non_bdl_event_story_player_tags_story_id_idx" ON "non_bdl_event_story_player_tags" USING btree ("story_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "non_bdl_event_photos_event_id_idx" ON "non_bdl_event_photos" USING btree ("event_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "non_bdl_event_photo_team_tags_uidx" ON "non_bdl_event_photo_team_tags" USING btree ("photo_id","team_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "non_bdl_event_photo_team_tags_photo_id_idx" ON "non_bdl_event_photo_team_tags" USING btree ("photo_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "non_bdl_event_photo_player_tags_uidx" ON "non_bdl_event_photo_player_tags" USING btree ("photo_id","player_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "non_bdl_event_photo_player_tags_photo_id_idx" ON "non_bdl_event_photo_player_tags" USING btree ("photo_id");
