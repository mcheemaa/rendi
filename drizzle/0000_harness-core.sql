CREATE TABLE "conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text DEFAULT 'New conversation' NOT NULL,
	"public_access_token" text,
	"last_event_id" text,
	"turns" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"conversation_id" text NOT NULL,
	"id" text NOT NULL,
	"position" integer NOT NULL,
	"turn" integer NOT NULL,
	"role" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "messages_conversation_id_id_pk" PRIMARY KEY("conversation_id","id"),
	CONSTRAINT "messages_conversation_id_position_unique" UNIQUE("conversation_id","position")
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;