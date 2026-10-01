CREATE TABLE IF NOT EXISTS "outbound_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel" text NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"to_address" text,
	"subject" text,
	"provider" text,
	"provider_message_id" text,
	"error_message" text,
	"skip_reason" text,
	"contact_job_id" uuid,
	"player_id" uuid,
	"created_by_admin_email" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_contact_job_id_contact_jobs_id_fk" FOREIGN KEY ("contact_job_id") REFERENCES "public"."contact_jobs"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "outbound_messages" ADD CONSTRAINT "outbound_messages_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outbound_messages_created_at_idx" ON "outbound_messages" USING btree ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outbound_messages_status_idx" ON "outbound_messages" USING btree ("status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outbound_messages_channel_idx" ON "outbound_messages" USING btree ("channel");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "outbound_messages_provider_message_id_idx" ON "outbound_messages" USING btree ("provider_message_id");
--> statement-breakpoint
INSERT INTO "outbound_messages" (
	"channel",
	"kind",
	"status",
	"to_address",
	"subject",
	"provider",
	"provider_message_id",
	"error_message",
	"skip_reason",
	"contact_job_id",
	"player_id",
	"created_by_admin_email",
	"sent_at",
	"created_at",
	"updated_at"
)
SELECT
	j."channel",
	'contact',
	CASE
		WHEN r."status" IN ('sent', 'delivered', 'queued') THEN
			CASE WHEN r."status" = 'delivered' THEN 'delivered' WHEN r."status" = 'queued' THEN 'sent' ELSE 'sent' END
		WHEN r."status" = 'failed' THEN 'failed'
		WHEN r."status" = 'opted_out' THEN 'opted_out'
		ELSE 'skipped'
	END,
	r."address",
	COALESCE(
		j."subject",
		LEFT(COALESCE(j."body_text", ''), 120)
	),
	CASE
		WHEN j."channel" = 'email' THEN 'resend'
		ELSE 'twilio'
	END,
	r."provider_message_id",
	r."error_message",
	CASE
		WHEN r."status" = 'skipped' THEN r."skip_reason"
		WHEN r."status" = 'pending' THEN 'pending'
		ELSE NULL
	END,
	r."job_id",
	r."player_id",
	j."created_by_admin_email",
	r."sent_at",
	COALESCE(r."sent_at", r."updated_at", j."created_at"),
	COALESCE(r."updated_at", j."created_at")
FROM "contact_job_recipients" r
INNER JOIN "contact_jobs" j ON j."id" = r."job_id";
