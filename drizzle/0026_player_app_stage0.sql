ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "self_reported_skill" integer;
--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "player_app_account_id" uuid;
