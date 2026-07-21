CREATE TABLE "canvas_ops" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "canvas_ops_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"canvas_id" text NOT NULL,
	"conversation_id" text NOT NULL,
	"actor" text NOT NULL,
	"entry" jsonb NOT NULL,
	"seen_turn" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canvases" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"title" text DEFAULT 'Canvas' NOT NULL,
	"doc" jsonb NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "canvases_conversation_id_unique" UNIQUE("conversation_id")
);
--> statement-breakpoint
ALTER TABLE "canvases" ADD CONSTRAINT "canvases_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "canvas_ops_unseen_idx" ON "canvas_ops" USING btree ("conversation_id","seen_turn");