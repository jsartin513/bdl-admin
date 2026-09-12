ALTER TABLE "video_upload_sets" ADD COLUMN IF NOT EXISTS "auto_enqueue_on_ready" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "admin_notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_email" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"href" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_notifications_recipient_email_idx" ON "admin_notifications" USING btree ("recipient_email");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "admin_notifications_created_at_idx" ON "admin_notifications" USING btree ("created_at");
