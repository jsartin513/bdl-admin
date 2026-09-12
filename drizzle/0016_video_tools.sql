CREATE TABLE IF NOT EXISTS "video_upload_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_name" text NOT NULL,
	"label" text NOT NULL,
	"event_date" date NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by_email" text NOT NULL,
	"error_message" text,
	"merged_blob_url" text,
	"merged_blob_pathname" text,
	"output_filename" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "video_upload_clips" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"set_id" uuid NOT NULL,
	"original_filename" text NOT NULL,
	"blob_url" text NOT NULL,
	"pathname" text NOT NULL,
	"size_bytes" integer DEFAULT 0 NOT NULL,
	"sort_index" integer,
	"upload_complete" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "video_upload_clips" ADD CONSTRAINT "video_upload_clips_set_id_video_upload_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."video_upload_sets"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_upload_sets_status_idx" ON "video_upload_sets" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_upload_sets_event_date_idx" ON "video_upload_sets" USING btree ("event_date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_upload_sets_created_at_idx" ON "video_upload_sets" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_upload_clips_set_id_idx" ON "video_upload_clips" USING btree ("set_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "video_upload_clips_pathname_uidx" ON "video_upload_clips" USING btree ("pathname");
