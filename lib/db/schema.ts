import type { UIMessage } from "ai";
import {
	index,
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	unique,
} from "drizzle-orm/pg-core";
import type { CanvasDoc } from "../rendi/canvas";
import type { OpEntry } from "../rendi/canvas-ops";
import type {
	DdCartLine,
	DdCartStatus,
	DdQuoteSnapshot,
} from "../rendi/doordash-cart";
import type { InstrumentSpec, Present } from "../rendi/instrument";

export const conversations = pgTable("conversations", {
	id: text("id").primaryKey(),
	title: text("title").notNull().default("New conversation"),
	publicAccessToken: text("public_access_token"),
	lastEventId: text("last_event_id"),
	turns: integer("turns").notNull().default(0),
	// Birth environment (from the Trigger key prefix). The 'prod' default
	// is load-bearing: worker versions that predate this column leave it
	// unset, and those sessions only ever run in prod.
	triggerEnv: text("trigger_env").notNull().default("prod"),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

export const messages = pgTable(
	"messages",
	{
		conversationId: text("conversation_id")
			.notNull()
			.references(() => conversations.id),
		id: text("id").notNull(),
		position: integer("position").notNull(),
		turn: integer("turn").notNull(),
		role: text("role").notNull(),
		payload: jsonb("payload").notNull().$type<UIMessage>(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		primaryKey({ columns: [table.conversationId, table.id] }),
		unique().on(table.conversationId, table.position),
	],
);

export const instruments = pgTable("instruments", {
	id: text("id").primaryKey(),
	conversationId: text("conversation_id")
		.notNull()
		.references(() => conversations.id),
	title: text("title").notNull(),
	sql: text("sql").notNull(),
	params: jsonb("params").notNull().$type<InstrumentSpec["params"]>(),
	present: jsonb("present").$type<Present>(),
	version: integer("version").notNull().default(1),
	// What the last execution actually ran with, which is what the user sees.
	currentValues: jsonb("current_values")
		.notNull()
		.$type<Record<string, string>>(),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

// Append-only steering log; no foreign keys so a late or replayed op can
// never fail the write. seen_turn marks delivery to the agent, at-least-once.
export const instrumentOps = pgTable(
	"instrument_ops",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		conversationId: text("conversation_id").notNull(),
		instrumentId: text("instrument_id").notNull(),
		actor: text("actor").notNull(),
		param: text("param").notNull(),
		oldValue: text("old_value").notNull(),
		newValue: text("new_value").notNull(),
		seenTurn: integer("seen_turn"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("instrument_ops_unseen_idx").on(table.conversationId, table.seenTurn),
	],
);

// One canvas per conversation for v1; conversation_id is a column, not a
// law, so workspace-level boards stay one migration away.
export const canvases = pgTable("canvases", {
	id: text("id").primaryKey(),
	conversationId: text("conversation_id")
		.notNull()
		.unique()
		.references(() => conversations.id),
	title: text("title").notNull().default("Canvas"),
	doc: jsonb("doc").notNull().$type<CanvasDoc>(),
	version: integer("version").notNull().default(0),
	createdAt: timestamp("created_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

// Append-only layout log, the instrument_ops sibling: no foreign keys so a
// late op can never fail the write, seen_turn for at-least-once delivery.
// Entries are enriched with before-values at apply time so readback stays a
// pure projection.
export const canvasOps = pgTable(
	"canvas_ops",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		canvasId: text("canvas_id").notNull(),
		conversationId: text("conversation_id").notNull(),
		actor: text("actor").notNull(),
		entry: jsonb("entry").notNull().$type<OpEntry>(),
		seenTurn: integer("seen_turn"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [
		index("canvas_ops_unseen_idx").on(table.conversationId, table.seenTurn),
	],
);

// Generated image bytes live here, base64 in a text column so any driver
// round-trips them untouched; the world only ever sees
// the /api/images/[id] URL, so swapping to blob storage at deploy touches
// nothing downstream.
export const images = pgTable(
	"images",
	{
		id: text("id").primaryKey(),
		conversationId: text("conversation_id")
			.notNull()
			.references(() => conversations.id),
		kind: text("kind").notNull().default("generated"),
		prompt: text("prompt").notNull(),
		mime: text("mime").notNull(),
		data: text("data").notNull(),
		width: integer("width").notNull(),
		height: integer("height").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [index("images_conversation_idx").on(table.conversationId)],
);

// A pulse is a standing instruction the agent scheduled for itself; the
// Trigger schedule delivers heartbeats, this row carries the meaning.
export const pulses = pgTable(
	"pulses",
	{
		id: text("id").primaryKey(),
		conversationId: text("conversation_id")
			.notNull()
			.references(() => conversations.id),
		instruction: text("instruction").notNull(),
		cron: text("cron").notNull(),
		timezone: text("timezone").notNull().default("UTC"),
		scheduleId: text("schedule_id").notNull(),
		beats: integer("beats").notNull().default(0),
		lastBeatAt: timestamp("last_beat_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [index("pulses_conversation_idx").on(table.conversationId)],
);

// Ingestion state for catalog datasets: the OLTP record of what lives in
// the OLAP store, updated live by the ingest task's progress poller.
export const datasets = pgTable("datasets", {
	slug: text("slug").primaryKey(),
	tableName: text("table_name").notNull(),
	status: text("status").notNull(),
	rowsLoaded: integer("rows_loaded").notNull().default(0),
	rowsEstimate: integer("rows_estimate").notNull().default(0),
	error: text("error"),
	startedAt: timestamp("started_at", { withTimezone: true }),
	finishedAt: timestamp("finished_at", { withTimezone: true }),
	updatedAt: timestamp("updated_at", { withTimezone: true })
		.notNull()
		.defaultNow(),
});

// Every email the agent sends, one row per accepted send: the audit
// trail, and the counter behind the per-conversation daily cap.
export const emails = pgTable(
	"emails",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		conversationId: text("conversation_id").notNull(),
		to: text("to").notNull(),
		subject: text("subject").notNull(),
		resendId: text("resend_id").notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [index("emails_conversation_idx").on(table.conversationId)],
);

// DoorDash render snapshots: the cart's truth lives at DoorDash, these
// rows are what cards paint from and what history renders forever.
export const ddCarts = pgTable(
	"dd_carts",
	{
		cartUuid: text("cart_uuid").primaryKey(),
		conversationId: text("conversation_id")
			.notNull()
			.references(() => conversations.id),
		storeId: text("store_id").notNull(),
		storeName: text("store_name").notNull(),
		storeImageUrl: text("store_image_url"),
		items: jsonb("items").notNull().$type<DdCartLine[]>(),
		quote: jsonb("quote").$type<DdQuoteSnapshot>(),
		fulfillment: text("fulfillment").notNull().default("delivery"),
		scheduledTime: text("scheduled_time"),
		tipCents: integer("tip_cents").notNull().default(0),
		status: text("status").notNull().default("open").$type<DdCartStatus>(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [index("dd_carts_conversation_idx").on(table.conversationId)],
);

// One-time-code approvals: single-use, hash-bound to the exact previewed
// cart, only satisfiable by a code from the owner's inbox. The code
// itself never persists and never enters the transcript.
export const ddApprovals = pgTable(
	"dd_approvals",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		conversationId: text("conversation_id").notNull(),
		cartUuid: text("cart_uuid").notNull(),
		cartHash: text("cart_hash").notNull(),
		totalCents: integer("total_cents").notNull(),
		tipCents: integer("tip_cents").notNull(),
		codeHash: text("code_hash").notNull(),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		attempts: integer("attempts").notNull().default(0),
		verifiedAt: timestamp("verified_at", { withTimezone: true }),
		consumedAt: timestamp("consumed_at", { withTimezone: true }),
		voidedAt: timestamp("voided_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [index("dd_approvals_cart_idx").on(table.cartUuid)],
);

// One row per submission attempt, keyed by its approval so a re-fired
// turn reads the recorded outcome instead of charging twice. Also the
// daily-cap counter.
export const ddOrders = pgTable(
	"dd_orders",
	{
		id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
		approvalId: integer("approval_id")
			.notNull()
			.unique()
			.references(() => ddApprovals.id),
		conversationId: text("conversation_id").notNull(),
		cartUuid: text("cart_uuid").notNull(),
		orderUuid: text("order_uuid"),
		storeName: text("store_name").notNull(),
		totalCents: integer("total_cents").notNull(),
		status: text("status").notNull().default("pending"),
		errorMessage: text("error_message"),
		receipt: jsonb("receipt"),
		createdAt: timestamp("created_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow(),
	},
	(table) => [index("dd_orders_created_idx").on(table.createdAt)],
);

export type ConversationRow = typeof conversations.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
export type DdCartRow = typeof ddCarts.$inferSelect;
export type DdApprovalRow = typeof ddApprovals.$inferSelect;
export type DdOrderRow = typeof ddOrders.$inferSelect;
export type InstrumentRow = typeof instruments.$inferSelect;
export type InstrumentOpRow = typeof instrumentOps.$inferSelect;
export type CanvasRow = typeof canvases.$inferSelect;
export type CanvasOpRow = typeof canvasOps.$inferSelect;
export type ImageRow = typeof images.$inferSelect;
export type PulseRow = typeof pulses.$inferSelect;
export type DatasetRow = typeof datasets.$inferSelect;
