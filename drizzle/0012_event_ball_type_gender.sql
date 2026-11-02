ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "ball_type" text DEFAULT 'foam' NOT NULL;
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "gender" text DEFAULT 'mixed' NOT NULL;
