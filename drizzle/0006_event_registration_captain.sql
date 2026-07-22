ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "is_captain" boolean NOT NULL DEFAULT false;
