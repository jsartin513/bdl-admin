ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "pairing_enabled" boolean DEFAULT true NOT NULL;
