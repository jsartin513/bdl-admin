ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "team_locked" boolean DEFAULT false NOT NULL;
