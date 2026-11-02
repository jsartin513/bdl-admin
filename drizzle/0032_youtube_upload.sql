ALTER TABLE "video_upload_sets" ADD COLUMN IF NOT EXISTS "youtube_playlist_id" text;
--> statement-breakpoint
ALTER TABLE "video_upload_sets" ADD COLUMN IF NOT EXISTS "youtube_playlist_title" text;
--> statement-breakpoint
ALTER TABLE "video_upload_sets" ADD COLUMN IF NOT EXISTS "youtube_privacy" text DEFAULT 'unlisted' NOT NULL;
--> statement-breakpoint
ALTER TABLE "video_upload_sets" ADD COLUMN IF NOT EXISTS "youtube_upload_status" text DEFAULT 'none' NOT NULL;
--> statement-breakpoint
ALTER TABLE "video_upload_sets" ADD COLUMN IF NOT EXISTS "youtube_video_id" text;
--> statement-breakpoint
ALTER TABLE "video_upload_sets" ADD COLUMN IF NOT EXISTS "youtube_video_url" text;
--> statement-breakpoint
ALTER TABLE "video_upload_sets" ADD COLUMN IF NOT EXISTS "youtube_error_message" text;
--> statement-breakpoint
ALTER TABLE "video_upload_sets" ADD COLUMN IF NOT EXISTS "youtube_claim_token" uuid;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_upload_sets_youtube_upload_status_idx" ON "video_upload_sets" USING btree ("youtube_upload_status");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "youtube_channel_connection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" text NOT NULL,
	"channel_title" text NOT NULL,
	"refresh_token_enc" text NOT NULL,
	"connected_by_email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
