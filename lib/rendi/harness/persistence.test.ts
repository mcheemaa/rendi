import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import type { TurnCompleteEvent, TurnStartEvent } from "@trigger.dev/sdk/ai";
import type { UIMessage } from "ai";
import { drizzle } from "drizzle-orm/pglite";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "../../db/schema.ts";
import {
	persistChatStart,
	persistTurnComplete,
	persistTurnStart,
} from "./persistence.ts";

const holder = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("../../db/index.ts", () => ({
	getDb: () => holder.db,
}));

const CHAT = "test-chat";

function msg(id: string, role: "user" | "assistant", text: string): UIMessage {
	return { id, role, parts: [{ type: "text", text }] };
}

function startEvent(uiMessages: UIMessage[], turn: number): TurnStartEvent {
	return { chatId: CHAT, uiMessages, turn } as unknown as TurnStartEvent;
}

function completeEvent(
	uiMessages: UIMessage[],
	newUIMessages: UIMessage[],
	turn: number,
	overrides: Partial<{ chatAccessToken: string; lastEventId?: string }> = {},
): TurnCompleteEvent {
	return {
		chatId: CHAT,
		uiMessages,
		newUIMessages,
		turn,
		chatAccessToken: overrides.chatAccessToken ?? `pat-turn-${turn}`,
		lastEventId: overrides.lastEventId,
	} as unknown as TurnCompleteEvent;
}

async function rows() {
	const db = holder.db as ReturnType<typeof drizzle>;
	const result = await db.execute(
		`select id, position, turn, role from messages where conversation_id = '${CHAT}' order by position`,
	);
	return result.rows as {
		id: string;
		position: number;
		turn: number;
		role: string;
	}[];
}

async function conversation() {
	const db = holder.db as ReturnType<typeof drizzle>;
	const result = await db.execute(
		`select title, turns, public_access_token, last_event_id from conversations where id = '${CHAT}'`,
	);
	return result.rows[0] as {
		title: string;
		turns: number;
		public_access_token: string | null;
		last_event_id: string | null;
	};
}

const u0 = msg("u0", "user", "first question");
const a0 = msg("a0", "assistant", "first answer");
const u1 = msg("u1", "user", "second question");
const a1 = msg("a1", "assistant", "partial answer");
const u2 = msg("u2", "user", "third question");

beforeEach(async () => {
	const client = new PGlite();
	const migration = readFileSync("drizzle/0000_harness-core.sql", "utf8");
	for (const statement of migration.split("--> statement-breakpoint")) {
		await client.exec(statement);
	}
	holder.db = drizzle(client, { schema });
});

describe("chat start", () => {
	it("lands the session token before the first turn exists", async () => {
		await persistChatStart({ chatId: CHAT, chatAccessToken: "pat-first" });
		const convo = await conversation();
		expect(convo.public_access_token).toBe("pat-first");
		expect(convo.turns).toBe(0);
	});

	it("refreshes the token on continuation without touching history", async () => {
		await persistTurnStart(startEvent([u0], 0));
		await persistTurnComplete(completeEvent([u0, a0], [u0, a0], 0));
		await persistChatStart({ chatId: CHAT, chatAccessToken: "pat-continued" });
		const convo = await conversation();
		expect(convo.public_access_token).toBe("pat-continued");
		expect((await rows()).map((r) => r.id)).toEqual(["u0", "a0"]);
	});

	it("never clobbers a stored token with a blank one", async () => {
		await persistChatStart({ chatId: CHAT, chatAccessToken: "pat-real" });
		await persistChatStart({ chatId: CHAT, chatAccessToken: "" });
		expect((await conversation()).public_access_token).toBe("pat-real");
	});
});

describe("instant title", () => {
	it("titles a new conversation with the first user message excerpt", async () => {
		await persistTurnStart(startEvent([u0], 0));
		expect((await conversation()).title).toBe("first question");
	});

	it("never overwrites a title that already exists", async () => {
		await persistTurnStart(startEvent([u0], 0));
		const db = holder.db as ReturnType<typeof drizzle>;
		await db.execute(
			`update conversations set title = 'Haiku Title' where id = '${CHAT}'`,
		);
		await persistTurnStart(startEvent([u0, a0, u1], 1));
		expect((await conversation()).title).toBe("Haiku Title");
	});
});

describe("happy path", () => {
	it("persists two turns with index positions and turn attribution", async () => {
		await persistTurnStart(startEvent([u0], 0));
		await persistTurnComplete(completeEvent([u0, a0], [u0, a0], 0));
		await persistTurnStart(startEvent([u0, a0, u1], 1));
		await persistTurnComplete(completeEvent([u0, a0, u1, a1], [u1, a1], 1));

		expect(await rows()).toEqual([
			{ id: "u0", position: 0, turn: 0, role: "user" },
			{ id: "a0", position: 1, turn: 0, role: "assistant" },
			{ id: "u1", position: 2, turn: 1, role: "user" },
			{ id: "a1", position: 3, turn: 1, role: "assistant" },
		]);
		const convo = await conversation();
		expect(convo.turns).toBe(2);
		expect(convo.public_access_token).toBe("pat-turn-1");
	});

	it("is idempotent when turn-complete fires twice for the same turn", async () => {
		await persistTurnStart(startEvent([u0], 0));
		const event = completeEvent([u0, a0], [u0, a0], 0);
		await persistTurnComplete(event);
		await persistTurnComplete(event);
		expect((await rows()).map((r) => r.id)).toEqual(["u0", "a0"]);
	});
});

describe("the error-path double fire (reviewer P1-1)", () => {
	it("survives a failed turn-start followed by the SDK error fire without losing the assistant", async () => {
		await persistTurnStart(startEvent([u0], 0));
		await persistTurnComplete(completeEvent([u0, a0], [u0, a0], 0));

		// Turn 1's persistTurnStart is skipped: the simulated transient Neon
		// failure. The SDK then fires the error-path onTurnComplete with the
		// full chain (partial assistant included), only the wire user message
		// as new, and a blank access token (verified in ai.js).
		await persistTurnComplete(
			completeEvent([u0, a0, u1, a1], [u1], 1, { chatAccessToken: "" }),
		);

		// Next turn heals; a1 must land, u1 must sit at its true index.
		await persistTurnStart(startEvent([u0, a0, u1, a1, u2], 2));

		expect(await rows()).toEqual([
			{ id: "u0", position: 0, turn: 0, role: "user" },
			{ id: "a0", position: 1, turn: 0, role: "assistant" },
			{ id: "u1", position: 2, turn: 1, role: "user" },
			{ id: "a1", position: 3, turn: 1, role: "assistant" },
			{ id: "u2", position: 4, turn: 2, role: "user" },
		]);
	});

	it("never clobbers a stored access token or cursor with blank error-path values", async () => {
		await persistTurnStart(startEvent([u0], 0));
		await persistTurnComplete(
			completeEvent([u0, a0], [u0, a0], 0, {
				chatAccessToken: "pat-real",
				lastEventId: "cursor-5",
			}),
		);
		await persistTurnComplete(
			completeEvent([u0, a0, u1], [u1], 1, { chatAccessToken: "" }),
		);
		const convo = await conversation();
		expect(convo.public_access_token).toBe("pat-real");
		expect(convo.last_event_id).toBe("cursor-5");
	});
});

describe("heal on read", () => {
	it("restores a deleted interior row with neighbor-derived turn attribution", async () => {
		await persistTurnStart(startEvent([u0], 0));
		await persistTurnComplete(completeEvent([u0, a0], [u0, a0], 0));
		await persistTurnStart(startEvent([u0, a0, u1], 1));
		await persistTurnComplete(completeEvent([u0, a0, u1, a1], [u1, a1], 1));

		const db = holder.db as ReturnType<typeof drizzle>;
		await db.execute(
			`delete from messages where conversation_id = '${CHAT}' and id = 'a0'`,
		);

		await persistTurnStart(startEvent([u0, a0, u1, a1, u2], 2));
		const healed = (await rows()).find((r) => r.id === "a0");
		expect(healed).toEqual({
			id: "a0",
			position: 1,
			turn: 0,
			role: "assistant",
		});
	});
});

describe("regeneration", () => {
	it("replaces a regenerated tail and repositions cleanly", async () => {
		await persistTurnStart(startEvent([u0], 0));
		await persistTurnComplete(completeEvent([u0, a0], [u0, a0], 0));

		const regenerated = msg("a0-v2", "assistant", "regenerated answer");
		await persistTurnStart(startEvent([u0, regenerated], 0));

		expect(await rows()).toEqual([
			{ id: "u0", position: 0, turn: 0, role: "user" },
			{ id: "a0-v2", position: 1, turn: 0, role: "assistant" },
		]);
	});
});
