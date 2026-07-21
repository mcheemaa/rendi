CREATE TABLE "instrument_ops" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "instrument_ops_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"conversation_id" text NOT NULL,
	"instrument_id" text NOT NULL,
	"actor" text NOT NULL,
	"param" text NOT NULL,
	"old_value" text NOT NULL,
	"new_value" text NOT NULL,
	"seen_turn" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instruments" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"title" text NOT NULL,
	"sql" text NOT NULL,
	"params" jsonb NOT NULL,
	"present" jsonb,
	"version" integer DEFAULT 1 NOT NULL,
	"current_values" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "instruments" ADD CONSTRAINT "instruments_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "instrument_ops_unseen_idx" ON "instrument_ops" USING btree ("conversation_id","seen_turn");