CREATE TABLE IF NOT EXISTS "player_phones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"phone_e164" text NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
-->statement-breakpoint
CREATE TABLE IF NOT EXISTS "player_messaging_prefs" (
	"player_id" uuid PRIMARY KEY NOT NULL,
	"email_opt_out_at" timestamp with time zone,
	"sms_opt_in_at" timestamp with time zone,
	"sms_opt_out_at" timestamp with time zone,
	"whatsapp_opt_in_at" timestamp with time zone,
	"whatsapp_opt_out_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
-->statement-breakpoint
CREATE TABLE IF NOT EXISTS "contact_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_by_admin_email" text NOT NULL,
	"channel" text NOT NULL,
	"audience_type" text NOT NULL,
	"audience_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"event_id" uuid,
	"subject" text,
	"body_text" text,
	"body_html" text,
	"template_sid" text,
	"template_variables" jsonb,
	"status" text DEFAULT 'draft' NOT NULL,
	"error_message" text,
	"idempotency_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
-->statement-breakpoint
CREATE TABLE IF NOT EXISTS "contact_job_recipients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"address" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"skip_reason" text,
	"provider_message_id" text,
	"error_message" text,
	"sent_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
-->statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "player_phones" ADD CONSTRAINT "player_phones_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
-->statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "player_messaging_prefs" ADD CONSTRAINT "player_messaging_prefs_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
-->statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contact_jobs" ADD CONSTRAINT "contact_jobs_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
-->statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contact_job_recipients" ADD CONSTRAINT "contact_job_recipients_job_id_contact_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."contact_jobs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
-->statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contact_job_recipients" ADD CONSTRAINT "contact_job_recipients_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
-->statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "player_phones_phone_e164_uidx" ON "player_phones" USING btree ("phone_e164");
-->statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_jobs_created_at_idx" ON "contact_jobs" USING btree ("created_at");
-->statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_jobs_status_idx" ON "contact_jobs" USING btree ("status");
-->statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "contact_jobs_idempotency_key_uidx" ON "contact_jobs" USING btree ("idempotency_key");
-->statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_job_recipients_job_id_idx" ON "contact_job_recipients" USING btree ("job_id");
-->statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_job_recipients_player_id_idx" ON "contact_job_recipients" USING btree ("player_id");
-->statement-breakpoint
CREATE INDEX IF NOT EXISTS "contact_job_recipients_provider_message_id_idx" ON "contact_job_recipients" USING btree ("provider_message_id");
-->statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "contact_job_recipients_job_player_uidx" ON "contact_job_recipients" USING btree ("job_id","player_id");
