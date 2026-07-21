CREATE TABLE "images" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"prompt" text NOT NULL,
	"mime" text NOT NULL,
	"data" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "images_conversation_idx" ON "images" USING btree ("conversation_id");