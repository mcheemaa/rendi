import { anthropic } from "@ai-sdk/anthropic";
import type { UIMessage } from "ai";
import { generateText } from "ai";
import { eq } from "drizzle-orm";
import { getDb } from "../../db/index.ts";
import { conversations } from "../../db/schema.ts";
import { emitSpan } from "./telemetry.ts";

const TITLE_TURNS = new Set([0, 2]);
const TITLE_MODEL = "claude-haiku-4-5";
const DIGEST_CAP = 2400;
const TITLE_CAP = 64;

function digest(uiMessages: UIMessage[]): string {
	const lines: string[] = [];
	for (const message of uiMessages) {
		const text = message.parts
			.filter((part) => part.type === "text")
			.map((part) => part.text)
			.join(" ")
			.trim();
		if (text) lines.push(`${message.role}: ${text}`);
	}
	return lines.join("\n").slice(0, DIGEST_CAP);
}

function sanitize(raw: string): string {
	let title = raw.trim().replace(/\s+/g, " ");
	const wrapped = title.match(/^["'“‘](.+)["'”’]$/);
	if (wrapped?.[1]) title = wrapped[1].trim();
	if (title.length <= TITLE_CAP) return title;
	const cut = title.slice(0, TITLE_CAP);
	const boundary = cut.lastIndexOf(" ");
	return boundary > TITLE_CAP / 2 ? cut.slice(0, boundary) : cut;
}

// Titling is a side quest: any failure logs and leaves the current
// title standing until the next title turn.
export async function maybeUpdateTitle(
	event: {
		chatId: string;
		turn: number;
		uiMessages: UIMessage[];
	},
	parentSpanId?: string,
): Promise<void> {
	if (!TITLE_TURNS.has(event.turn)) return;
	try {
		const conversation = digest(event.uiMessages);
		if (!conversation) return;
		const startedAt = performance.now();
		const { text, usage } = await generateText({
			model: anthropic(TITLE_MODEL),
			system:
				"You name conversations for a sidebar. Reply with only the title: " +
				"3 to 6 plain words, no quotes, no trailing punctuation, " +
				"specific to the subject rather than the activity.",
			prompt: `Name this conversation.\n\n${conversation}`,
		});
		const title = sanitize(text);
		emitSpan({
			conversationId: event.chatId,
			turn: event.turn,
			parentSpanId,
			spanKind: "llm",
			name: "title",
			model: TITLE_MODEL,
			input: conversation,
			output: title,
			usage,
			durationMs: performance.now() - startedAt,
		});
		if (!title) return;
		await getDb()
			.update(conversations)
			.set({ title })
			.where(eq(conversations.id, event.chatId));
	} catch (error) {
		console.error("[titles] update failed", error);
	}
}
