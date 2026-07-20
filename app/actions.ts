"use server";

import { auth } from "@trigger.dev/sdk";
import { chat } from "@trigger.dev/sdk/ai";
import type { rendiChat } from "@/trigger/chat";

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
