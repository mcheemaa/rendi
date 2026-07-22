"use server";

import { auth } from "@trigger.dev/sdk";
import { chat } from "@trigger.dev/sdk/ai";
import {
	type ConversationCursor,
	pageConversations,
	searchConversations,
} from "@/lib/db/queries";
import { appBase } from "@/lib/rendi/app-url";
import { mintRenderToken, SHARE_TTL_MS } from "@/lib/rendi/render-token";
import type { rendiChat } from "@/trigger/chat";

export async function fetchConversationPage(before?: ConversationCursor) {
	const page = await pageConversations(before);
	return {
		items: page.items.map(({ id, title }) => ({ id, title })),
		cursor: page.cursor,
	};
}

export async function createShareLink(conversationId: string) {
	const token = mintRenderToken(conversationId, SHARE_TTL_MS, "share");
	return { url: `${appBase()}/s/${conversationId}?t=${token}` };
}

export async function findConversations(query: string) {
	const trimmed = query.trim();
	if (!trimmed) return [];
	const rows = await searchConversations(trimmed);
	return rows.map(({ id, title }) => ({ id, title }));
}

export const startChatSession =
	chat.createStartSessionAction<typeof rendiChat>("rendi-chat");

export async function mintChatAccessToken(chatId: string): Promise<string> {
	return auth.createPublicToken({
		scopes: {
			read: { sessions: [chatId] },
			write: { sessions: [chatId] },
		},
		expirationTime: "1h",
	});
}
