CREATE TABLE IF NOT EXISTS "player_home_leagues" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "player_id" uuid NOT NULL,
  "home_league" text NOT NULL,
  "sort_order" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

DO $$ BEGIN
 ALTER TABLE "player_home_leagues" ADD CONSTRAINT "player_home_leagues_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "player_home_leagues_player_league_uidx" ON "player_home_leagues" USING btree ("player_id","home_league");
CREATE INDEX IF NOT EXISTS "player_home_leagues_player_sort_idx" ON "player_home_leagues" USING btree ("player_id","sort_order");
