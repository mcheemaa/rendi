CREATE TABLE "dd_approvals" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "dd_approvals_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"conversation_id" text NOT NULL,
	"cart_uuid" text NOT NULL,
	"cart_hash" text NOT NULL,
	"total_cents" integer NOT NULL,
	"tip_cents" integer NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"verified_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dd_carts" (
	"cart_uuid" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"store_id" text NOT NULL,
	"store_name" text NOT NULL,
	"store_image_url" text,
	"items" jsonb NOT NULL,
	"quote" jsonb,
	"fulfillment" text DEFAULT 'delivery' NOT NULL,
	"scheduled_time" text,
	"tip_cents" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dd_orders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "dd_orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"approval_id" integer NOT NULL,
	"conversation_id" text NOT NULL,
	"cart_uuid" text NOT NULL,
	"order_uuid" text,
	"store_name" text NOT NULL,
	"total_cents" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"receipt" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dd_orders_approval_id_unique" UNIQUE("approval_id")
);
--> statement-breakpoint
ALTER TABLE "dd_carts" ADD CONSTRAINT "dd_carts_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dd_orders" ADD CONSTRAINT "dd_orders_approval_id_dd_approvals_id_fk" FOREIGN KEY ("approval_id") REFERENCES "public"."dd_approvals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "dd_approvals_cart_idx" ON "dd_approvals" USING btree ("cart_uuid");--> statement-breakpoint
CREATE INDEX "dd_carts_conversation_idx" ON "dd_carts" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "dd_orders_created_idx" ON "dd_orders" USING btree ("created_at");