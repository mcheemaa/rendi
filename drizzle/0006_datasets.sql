CREATE TABLE "datasets" (
	"slug" text PRIMARY KEY NOT NULL,
	"table_name" text NOT NULL,
	"status" text NOT NULL,
	"rows_loaded" integer DEFAULT 0 NOT NULL,
	"rows_estimate" integer DEFAULT 0 NOT NULL,
	"error" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
