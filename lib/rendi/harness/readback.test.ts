import type { ModelMessage } from "ai";
import type { drizzle } from "drizzle-orm/pglite";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	instrumentStateBlock,
	markOpsSeen,
	persistExecution,
	withInstrumentState,
} from "./readback.ts";
import { createTestDb } from "./test-db.ts";

const holder = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("../../db/index.ts", () => ({
	getDb: () => holder.db,
}));

const CHAT = "readback-chat";

function db() {
	return holder.db as ReturnType<typeof drizzle>;
}

const execution = {
	conversationId: CHAT,
	instrumentId: "inst-1",
	title: "Daily commit counts",
	sqlText:
		"SELECT toDate(ts) AS day, count() AS commits FROM git.commits WHERE ts >= {since:DateTime}",
	params: [
		{
			name: "since",
			type: "DateTime",
			control: "timerange" as const,
			defaultValue: "now-30d",
		},
	],
	version: 1,
	values: { since: "now-30d" },
};

function block() {
	return instrumentStateBlock(CHAT);
}

function parsed(text: string) {
	return JSON.parse(
		text.replace("<instrument_state>", "").replace("</instrument_state>", ""),
	);
}

beforeEach(async () => {
	holder.db = await createTestDb();
	await db().execute(`insert into conversations (id) values ('${CHAT}')`);
});

describe("persistExecution", () => {
	it("creates the instrument row with what actually ran", async () => {
		await persistExecution(execution);
		const rows = await db().execute(
			`select title, current_values from instruments where id = 'inst-1'`,
		);
		expect(rows.rows[0]).toMatchObject({
			title: "Daily commit counts",
			current_values: { since: "now-30d" },
		});
	});

	it("keeps current values in step with re-executions", async () => {
		await persistExecution(execution);
		await persistExecution({ ...execution, values: { since: "now-7d" } });
		const rows = await db().execute(
			`select current_values from instruments where id = 'inst-1'`,
		);
		expect(rows.rows[0].current_values).toEqual({ since: "now-7d" });
	});

	it("appends a user op only when a steer happened", async () => {
		await persistExecution(execution);
		await persistExecution({
			...execution,
			values: { since: "now-7d" },
			steer: { param: "since", old: "now-30d", new: "now-7d" },
		});
		const ops = await db().execute(
			`select actor, param, old_value, new_value, seen_turn from instrument_ops`,
		);
		expect(ops.rows).toEqual([
			{
				actor: "user",
				param: "since",
				old_value: "now-30d",
				new_value: "now-7d",
				seen_turn: null,
			},
		]);
	});
});

describe("instrumentStateBlock", () => {
	it("stays silent for conversations without instruments", async () => {
		expect(await block()).toBeUndefined();
	});

	it("carries values, defaults, and the actor-tagged delta", async () => {
		await persistExecution(execution);
		await persistExecution({
			...execution,
			values: { since: "now-7d" },
			steer: { param: "since", old: "now-30d", new: "now-7d" },
		});
		const state = parsed((await block()) ?? "");
		expect(state.instruments).toEqual([
			{
				id: "inst-1",
				title: "Daily commit counts",
				values: { since: "now-7d" },
				defaults: { since: "now-30d" },
			},
		]);
		expect(state.since_your_last_turn).toMatchObject([
			{
				instrument: "inst-1",
				actor: "user",
				param: "since",
				from: "now-30d",
				to: "now-7d",
			},
		]);
	});

	it("keeps the snapshot but drops delivered ops after marking", async () => {
		await persistExecution(execution);
		await persistExecution({
			...execution,
			values: { since: "now-7d" },
			steer: { param: "since", old: "now-30d", new: "now-7d" },
		});
		await block();
		await markOpsSeen(CHAT, 1);

		const next = parsed((await block()) ?? "");
		expect(next.instruments).toHaveLength(1);
		expect(next.since_your_last_turn).toBeUndefined();

		const ops = await db().execute(`select seen_turn from instrument_ops`);
		expect(ops.rows[0].seen_turn).toBe(1);
	});

	it("never marks an op that landed after the block was built", async () => {
		await persistExecution(execution);
		await persistExecution({
			...execution,
			values: { since: "now-7d" },
			steer: { param: "since", old: "now-30d", new: "now-7d" },
		});
		await block();
		// The user steers again while the agent is mid-turn.
		await persistExecution({
			...execution,
			values: { since: "now-90d" },
			steer: { param: "since", old: "now-7d", new: "now-90d" },
		});
		await markOpsSeen(CHAT, 1);

		const next = parsed((await block()) ?? "");
		expect(next.since_your_last_turn).toMatchObject([
			{ from: "now-7d", to: "now-90d" },
		]);
	});
});

describe("withInstrumentState", () => {
	const messages: ModelMessage[] = [
		{ role: "user", content: "chart commits" },
		{ role: "assistant", content: "done" },
		{ role: "user", content: "why the spike?" },
	];

	it("rides just before the newest user message", () => {
		const staged = withInstrumentState(messages, "<instrument_state/>");
		expect(staged.map((m) => m.role)).toEqual([
			"user",
			"assistant",
			"user",
			"user",
		]);
		expect(staged[2].content).toBe("<instrument_state/>");
		expect(staged[3].content).toBe("why the spike?");
	});

	it("leaves the turn untouched without a block", () => {
		expect(withInstrumentState(messages, undefined)).toBe(messages);
	});
});
