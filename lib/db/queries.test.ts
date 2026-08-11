import type { drizzle } from "drizzle-orm/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "../rendi/harness/test-db.ts";
import { pageConversations, searchConversations } from "./queries.ts";

const holder = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("./index.ts", () => ({
	getDb: () => holder.db,
}));

const ORIGINAL = process.env.TRIGGER_SECRET_KEY;

beforeEach(async () => {
	holder.db = await createTestDb();
	const db = holder.db as ReturnType<typeof drizzle>;
	await db.execute(`
		insert into conversations (id, title, trigger_env, updated_at) values
		('p-1', 'Prod keeper', 'prod', now()),
		('d-1', 'Dev experiment', 'dev', now() - interval '1 minute')
	`);
});

afterEach(() => {
	if (ORIGINAL === undefined) delete process.env.TRIGGER_SECRET_KEY;
	else process.env.TRIGGER_SECRET_KEY = ORIGINAL;
});

describe("environment scoping", () => {
	it("prod lists only prod-born conversations", async () => {
		process.env.TRIGGER_SECRET_KEY = "tr_prod_x";
		const page = await pageConversations();
		expect(page.items.map((row) => row.id)).toEqual(["p-1"]);
	});

	it("dev is the workbench and lists everything", async () => {
		process.env.TRIGGER_SECRET_KEY = "tr_dev_x";
		const page = await pageConversations();
		expect(page.items.map((row) => row.id)).toEqual(["p-1", "d-1"]);
	});

	it("search scopes the same way", async () => {
		process.env.TRIGGER_SECRET_KEY = "tr_prod_x";
		expect(await searchConversations("e")).toHaveLength(1);
		process.env.TRIGGER_SECRET_KEY = "tr_dev_x";
		expect(await searchConversations("e")).toHaveLength(2);
	});
});
