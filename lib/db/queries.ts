import { desc, eq } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "./index.ts";
import { conversations, messages } from "./schema.ts";

export const listConversations = cache(async () => {
	return getDb()
		.select({
			id: conversations.id,
			title: conversations.title,
			updatedAt: conversations.updatedAt,
		})
		.from(conversations)
		.orderBy(desc(conversations.updatedAt))
		.limit(30);
});

export const getConversation = cache(async (id: string) => {
	const rows = await getDb()
		.select()
		.from(conversations)
		.where(eq(conversations.id, id))
		.limit(1);
	return rows[0];
});

export const getTranscript = cache(async (conversationId: string) => {
	const rows = await getDb()
		.select({ payload: messages.payload })
		.from(messages)
		.where(eq(messages.conversationId, conversationId))
		.orderBy(messages.position);
	return rows.map((row) => row.payload);
});
