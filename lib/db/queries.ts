import { and, desc, eq, ilike, lt, or } from "drizzle-orm";
import { cache } from "react";
import { getDb } from "./index.ts";
import { conversations, messages } from "./schema.ts";

export const CONVERSATION_PAGE = 25;

export type ConversationCursor = { updatedAt: string; id: string };

export type ConversationPage = {
	items: { id: string; title: string; updatedAt: Date }[];
	// The cursor doubles as hasMore: absent means the list is exhausted.
	cursor: ConversationCursor | null;
};

// Keyset pagination on (updatedAt, id): stable under the constant reordering
// a chat list lives with, where offsets would skip or repeat rows.
export async function pageConversations(
	before?: ConversationCursor,
): Promise<ConversationPage> {
	const rows = await getDb()
		.select({
			id: conversations.id,
			title: conversations.title,
			updatedAt: conversations.updatedAt,
		})
		.from(conversations)
		.where(
			before
				? or(
						lt(conversations.updatedAt, new Date(before.updatedAt)),
						and(
							eq(conversations.updatedAt, new Date(before.updatedAt)),
							lt(conversations.id, before.id),
						),
					)
				: undefined,
		)
		.orderBy(desc(conversations.updatedAt), desc(conversations.id))
		.limit(CONVERSATION_PAGE + 1);
	const items = rows.slice(0, CONVERSATION_PAGE);
	const last = items.at(-1);
	return {
		items,
		cursor:
			rows.length > CONVERSATION_PAGE && last
				? { updatedAt: last.updatedAt.toISOString(), id: last.id }
				: null,
	};
}

export async function searchConversations(query: string, limit = 15) {
	return getDb()
		.select({
			id: conversations.id,
			title: conversations.title,
			updatedAt: conversations.updatedAt,
		})
		.from(conversations)
		.where(ilike(conversations.title, `%${query}%`))
		.orderBy(desc(conversations.updatedAt), desc(conversations.id))
		.limit(limit);
}

export const listConversations = cache(pageConversations);

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
