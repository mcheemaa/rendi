"use server";

import { auth } from "@trigger.dev/sdk";
import { chat } from "@trigger.dev/sdk/ai";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
	type ConversationCursor,
	pageConversations,
	searchConversations,
} from "@/lib/db/queries";
import {
	ACCESS_COOKIE,
	ACCESS_TTL_MS,
	mintAccessToken,
} from "@/lib/rendi/access";
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

export async function enterAccessCode(
	_previous: { error?: string },
	formData: FormData,
): Promise<{ error?: string }> {
	const secret = process.env.ACCESS_TOKEN_SECRET;
	if (!secret) redirect("/");
	const codes = (process.env.ACCESS_CODES ?? "")
		.split(",")
		.map((code) => code.trim())
		.filter(Boolean);
	const entered = String(formData.get("code") ?? "").trim();
	if (!entered || !codes.includes(entered)) {
		return { error: "That code does not open the door." };
	}
	const jar = await cookies();
	jar.set(ACCESS_COOKIE, await mintAccessToken(secret), {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		maxAge: ACCESS_TTL_MS / 1000,
		path: "/",
	});
	const from = String(formData.get("from") ?? "");
	redirect(from.startsWith("/") && !from.startsWith("//") ? from : "/");
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
