ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "pair_id" uuid;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "event_registrations_event_pair_id_idx" ON "event_registrations" USING btree ("event_id","pair_id");
