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
import type { InstrumentSpec, Present } from "../rendi/instrument";

export const conversations = pgTable("conversations", {
	id: text("id").primaryKey(),
	title: text("title").notNull().default("New conversation"),
	publicAccessToken: text("public_access_token"),
	lastEventId: text("last_event_id"),
	turns: integer("turns").notNull().default(0),
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

export type ConversationRow = typeof conversations.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
export type InstrumentRow = typeof instruments.$inferSelect;
export type InstrumentOpRow = typeof instrumentOps.$inferSelect;
export type CanvasRow = typeof canvases.$inferSelect;
export type CanvasOpRow = typeof canvasOps.$inferSelect;
export type ImageRow = typeof images.$inferSelect;
export type PulseRow = typeof pulses.$inferSelect;
export type DatasetRow = typeof datasets.$inferSelect;
