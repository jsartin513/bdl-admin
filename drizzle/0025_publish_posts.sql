CREATE TABLE IF NOT EXISTS "publish_posts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "kind" text NOT NULL,
  "title" text NOT NULL,
  "caption" text DEFAULT '' NOT NULL,
  "media_url" text,
  "media_type" text,
  "include_open_gym_flyer" boolean DEFAULT false NOT NULL,
  "include_site_alert" boolean DEFAULT false NOT NULL,
  "site_alert_kind" text,
  "site_alert_ends_at" timestamp with time zone,
  "include_news_post" boolean DEFAULT false NOT NULL,
  "status" text DEFAULT 'draft' NOT NULL,
  "website_news_post_id" uuid,
  "website_site_alert_id" uuid,
  "website_news_slug" text,
  "posted_to_instagram" boolean DEFAULT false NOT NULL,
  "posted_to_youtube" boolean DEFAULT false NOT NULL,
  "approved_by" text,
  "approved_at" timestamp with time zone,
  "publish_error" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "publish_posts_status_idx" ON "publish_posts" USING btree ("status");
CREATE INDEX IF NOT EXISTS "publish_posts_created_at_idx" ON "publish_posts" USING btree ("created_at");
