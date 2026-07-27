-- Scale existing 1–4 skill levels to ×20 so midpoints are available.
UPDATE "players" SET "skill_level" = "skill_level" * 20 WHERE "skill_level" IS NOT NULL;-->statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "skill_level_fib" integer;-->statement-breakpoint
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "skill_areas" jsonb;
