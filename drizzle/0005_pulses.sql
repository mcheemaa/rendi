CREATE TABLE "pulses" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"instruction" text NOT NULL,
	"cron" text NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"schedule_id" text NOT NULL,
	"beats" integer DEFAULT 0 NOT NULL,
	"last_beat_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pulses" ADD CONSTRAINT "pulses_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pulses_conversation_idx" ON "pulses" USING btree ("conversation_id");