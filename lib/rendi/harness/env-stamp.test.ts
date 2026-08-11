import type { TurnStartEvent } from "@trigger.dev/sdk/ai";
import type { UIMessage } from "ai";
import type { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { persistChatStart, persistTurnStart } from "./persistence.ts";
import { createTestDb } from "./test-db.ts";

const holder = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("../../db/index.ts", () => ({
	getDb: () => holder.db,
}));

const ORIGINAL = process.env.TRIGGER_SECRET_KEY;

beforeEach(async () => {
	holder.db = await createTestDb();
	process.env.TRIGGER_SECRET_KEY = "tr_dev_test";
});

afterEach(() => {
	if (ORIGINAL === undefined) delete process.env.TRIGGER_SECRET_KEY;
	else process.env.TRIGGER_SECRET_KEY = ORIGINAL;
});

function startEvent(chatId: string): TurnStartEvent {
	const message: UIMessage = {
		id: "m-1",
		role: "user",
		parts: [{ type: "text", text: "hi" }],
	};
	return {
		chatId,
		uiMessages: [message],
		turn: 0,
	} as unknown as TurnStartEvent;
}

async function envOf(id: string) {
	const db = holder.db as ReturnType<typeof drizzle>;
	const result = await db.execute(
		`select trigger_env from conversations where id = '${id}'`,
	);
	return (result.rows[0] as { trigger_env?: string } | undefined)?.trigger_env;
}

describe("birth environment stamping", () => {
	it("stamps the worker's environment at chat start", async () => {
		await persistChatStart({ chatId: "c-1", chatAccessToken: "tok" });
		expect(await envOf("c-1")).toBe("dev");
	});

	it("stamps through the turn-start reconcile as well", async () => {
		await persistTurnStart(startEvent("c-2"));
		expect(await envOf("c-2")).toBe("dev");
	});

	it("never restamps an existing conversation", async () => {
		await persistChatStart({ chatId: "c-3", chatAccessToken: "tok" });
		process.env.TRIGGER_SECRET_KEY = "tr_prod_test";
		await persistChatStart({ chatId: "c-3", chatAccessToken: "tok2" });
		expect(await envOf("c-3")).toBe("dev");
	});
});
