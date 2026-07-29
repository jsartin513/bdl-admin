ALTER TABLE "video_upload_sets" ADD COLUMN IF NOT EXISTS "pending_upload_count" integer DEFAULT 0 NOT NULL;
