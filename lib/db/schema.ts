import type { UIMessage } from "ai";
import {
	integer,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	unique,
} from "drizzle-orm/pg-core";

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

export type ConversationRow = typeof conversations.$inferSelect;
export type MessageRow = typeof messages.$inferSelect;
