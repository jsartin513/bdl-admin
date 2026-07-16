ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "has_strong_personality" boolean NOT NULL DEFAULT false;
ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "strong_personality_notes" text;
