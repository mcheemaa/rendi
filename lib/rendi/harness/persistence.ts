import type {
	ChatStartEvent,
	TurnCompleteEvent,
	TurnStartEvent,
} from "@trigger.dev/sdk/ai";
import type { UIMessage } from "ai";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { PgUpdateSetSource } from "drizzle-orm/pg-core";
import { getDb } from "../../db/index.ts";
import { conversations, messages } from "../../db/schema.ts";

type Tx = Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0];

// The message log is written exclusively from the agent's lifecycle
// hooks, and both hooks converge through one reconcile: the runtime's
// uiMessages are authoritative, positions are their indexes, and any
// drift a failed write left behind (including the SDK's error-path
// re-fire, which carries only the wire user message as "new") is
// repaired on the next call. Position collisions throw; nothing is
// swallowed.
async function reconcile(
	tx: Tx,
	conversationId: string,
	uiMessages: UIMessage[],
	turn: number,
): Promise<void> {
	await tx
		.insert(conversations)
		.values({ id: conversationId })
		.onConflictDoUpdate({
			target: conversations.id,
			set: { updatedAt: sql`now()` },
		});

	// An empty authoritative chain never mass-deletes the log: absence of
	// history is indistinguishable from an upstream edge case, and delete
	// is the one operation heal cannot undo.
	if (uiMessages.length === 0) return;

	const existing = await tx
		.select({
			id: messages.id,
			position: messages.position,
			turn: messages.turn,
		})
		.from(messages)
		.where(eq(messages.conversationId, conversationId));
	const existingById = new Map(existing.map((row) => [row.id, row]));
	const desiredIndex = new Map(
		uiMessages.map((message, index) => [message.id, index]),
	);

	const orphaned = existing.filter((row) => !desiredIndex.has(row.id));
	if (orphaned.length > 0) {
		await tx.delete(messages).where(
			and(
				eq(messages.conversationId, conversationId),
				inArray(
					messages.id,
					orphaned.map((row) => row.id),
				),
			),
		);
	}

	const kept = existing.filter((row) => desiredIndex.has(row.id));
	const drifted = kept.some((row) => row.position !== desiredIndex.get(row.id));
	if (drifted) {
		// Two-phase reposition: park every kept row in negative space, then
		// place at the desired index, so intermediate states can never trip
		// the unique (conversation_id, position) constraint.
		for (const row of kept) {
			await tx
				.update(messages)
				.set({ position: -((desiredIndex.get(row.id) ?? 0) + 1) })
				.where(
					and(
						eq(messages.conversationId, conversationId),
						eq(messages.id, row.id),
					),
				);
		}
		for (const row of kept) {
			await tx
				.update(messages)
				.set({ position: desiredIndex.get(row.id) ?? 0 })
				.where(
					and(
						eq(messages.conversationId, conversationId),
						eq(messages.id, row.id),
					),
				);
		}
	}

	const maxKeptIndex = kept.reduce(
		(max, row) => Math.max(max, desiredIndex.get(row.id) ?? -1),
		-1,
	);
	let lastSeenTurn = 0;
	const inserts: (typeof messages.$inferInsert)[] = [];
	for (const [index, message] of uiMessages.entries()) {
		const known = existingById.get(message.id);
		if (known) {
			lastSeenTurn = known.turn;
			continue;
		}
		// Tail messages belong to the current turn; healed interior rows
		// take their predecessor's turn, the closest truth available.
		const assignedTurn = index > maxKeptIndex ? turn : lastSeenTurn;
		lastSeenTurn = assignedTurn;
		inserts.push({
			conversationId,
			id: message.id,
			position: index,
			turn: assignedTurn,
			role: message.role,
			payload: message,
		});
	}
	if (inserts.length > 0) {
		await tx.insert(messages).values(inserts);
	}
}

// Session token lands at chat start so a refresh during the very first
// turn can still attach to the live stream.
export async function persistChatStart(
	event: Pick<ChatStartEvent, "chatId" | "chatAccessToken">,
): Promise<void> {
	const patch: PgUpdateSetSource<typeof conversations> = {
		updatedAt: sql`now()`,
	};
	if (event.chatAccessToken) patch.publicAccessToken = event.chatAccessToken;
	await getDb()
		.insert(conversations)
		.values({
			id: event.chatId,
			...(event.chatAccessToken
				? { publicAccessToken: event.chatAccessToken }
				: {}),
		})
		.onConflictDoUpdate({ target: conversations.id, set: patch });
}

export async function persistTurnStart(event: TurnStartEvent): Promise<void> {
	await getDb().transaction(async (tx) => {
		await reconcile(tx, event.chatId, event.uiMessages, event.turn);
	});
}

export async function persistTurnComplete(
	event: TurnCompleteEvent,
): Promise<void> {
	await getDb().transaction(async (tx) => {
		await reconcile(tx, event.chatId, event.uiMessages, event.turn);

		const refreshed = event.newUIMessages.filter((message) =>
			event.uiMessages.some((current) => current.id === message.id),
		);
		for (const message of refreshed) {
			await tx
				.update(messages)
				.set({ payload: message, updatedAt: sql`now()` })
				.where(
					and(
						eq(messages.conversationId, event.chatId),
						eq(messages.id, message.id),
					),
				);
		}

		const patch: PgUpdateSetSource<typeof conversations> = {
			turns: event.turn + 1,
			updatedAt: sql`now()`,
		};
		// The SDK's error-path fire carries a blank token and no cursor;
		// blank values must never replace real ones.
		if (event.chatAccessToken) patch.publicAccessToken = event.chatAccessToken;
		if (event.lastEventId) patch.lastEventId = event.lastEventId;
		await tx
			.update(conversations)
			.set(patch)
			.where(eq(conversations.id, event.chatId));
	});
}
