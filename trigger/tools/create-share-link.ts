import { tool } from "ai";
import { z } from "zod";
import { appBase } from "@/lib/rendi/app-url";
import { turnContext } from "@/lib/rendi/harness/telemetry";
import { mintRenderToken, SHARE_TTL_MS } from "@/lib/rendi/render-token";

export const createShareLink = tool({
	description:
		"Create a share link to this conversation's live board. Anyone with the link sees the canvas with every instrument live and steerable, no account needed. Links last seven days. Use it when the user asks for something shareable, or when an email should point at the board.",
	inputSchema: z.object({}),
	execute: async () => {
		const turn = turnContext();
		if (!turn) throw new Error("create-share-link outside a turn");
		const token = mintRenderToken(turn.conversationId, SHARE_TTL_MS, "share");
		return {
			url: `${appBase()}/s/${turn.conversationId}?t=${token}`,
			expires_at: new Date(Date.now() + SHARE_TTL_MS).toISOString(),
		};
	},
});
