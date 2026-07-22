import type { UIMessage } from "ai";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { messages, pulses } from "@/lib/db/schema";

export const PULSE_MARKER = "[pulse";

export function heartbeatMessage(cron: string, instruction: string): UIMessage {
	return {
		id: crypto.randomUUID(),
		role: "user",
		parts: [{ type: "text", text: `${PULSE_MARKER} ${cron}] ${instruction}` }],
	};
}

// A newest user-role message means a turn is in flight or queued; the
// beat skips rather than stacking work under it. Pulse heartbeats are
// user-role too, so a wedged pulse turn also holds the next beat back.
export function turnLooksInFlight(
	newest: { role: string } | undefined,
): boolean {
	return newest?.role === "user";
}

export async function newestMessage(conversationId: string) {
	const db = getDb();
	const [row] = await db
		.select({ role: messages.role })
		.from(messages)
		.where(eq(messages.conversationId, conversationId))
		.orderBy(desc(messages.position))
		.limit(1);
	return row;
}

export async function pulsesFor(conversationId: string) {
	return getDb()
		.select()
		.from(pulses)
		.where(eq(pulses.conversationId, conversationId))
		.orderBy(pulses.createdAt);
}

export async function pulseById(id: string) {
	const [row] = await getDb().select().from(pulses).where(eq(pulses.id, id));
	return row;
}
