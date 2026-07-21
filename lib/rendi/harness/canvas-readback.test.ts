import type { drizzle } from "drizzle-orm/pglite";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CanvasBlock } from "../canvas.ts";
import { applyCanvasEntry } from "./canvas-db.ts";
import { canvasStateBlock, markCanvasOpsSeen } from "./canvas-readback.ts";
import { createTestDb } from "./test-db.ts";

const holder = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("../../db/index.ts", () => ({
	getDb: () => holder.db,
}));

const CHAT = "canvas-readback-chat";

function db() {
	return holder.db as ReturnType<typeof drizzle>;
}

function chart(id: string): CanvasBlock {
	return {
		id,
		kind: "instrument",
		frame: { x: 48, y: 48, w: 560, h: 336, z: 1 },
		instrument: { title: "Daily commits", sql: "SELECT 1", params: [] },
		paramState: { days: "30" },
	};
}

function parsed(text: string) {
	return JSON.parse(
		text.replace("<canvas_state>", "").replace("</canvas_state>", ""),
	);
}

beforeEach(async () => {
	holder.db = await createTestDb();
	await db().execute(`insert into conversations (id) values ('${CHAT}')`);
});

describe("canvasStateBlock", () => {
	it("stays silent without a canvas or blocks", async () => {
		expect(await canvasStateBlock(CHAT)).toBeUndefined();
	});

	it("carries the flattened arrangement and the actor-tagged delta", async () => {
		await applyCanvasEntry(
			CHAT,
			{ op: "add_block", block: chart("b_daily") },
			"agent",
		);
		await applyCanvasEntry(
			CHAT,
			{ op: "place", id: "b_daily", x: 640, y: 400 },
			"user",
		);

		const state = parsed((await canvasStateBlock(CHAT)) ?? "");
		expect(state.canvas.blocks).toEqual([
			{
				id: "b_daily",
				kind: "instrument",
				x: 640,
				y: 400,
				w: 560,
				h: 336,
				z: 1,
				title: "Daily commits",
				params: { days: "30" },
			},
		]);
		const moved = state.since_your_last_turn.at(-1);
		expect(moved).toMatchObject({
			actor: "user",
			op: "place",
			id: "b_daily",
			x: 640,
			y: 400,
			from: { x: 48, y: 48 },
		});
	});

	it("keeps the snapshot but drops delivered ops after marking", async () => {
		await applyCanvasEntry(
			CHAT,
			{ op: "add_block", block: chart("b_daily") },
			"agent",
		);
		await canvasStateBlock(CHAT);
		await markCanvasOpsSeen(CHAT, 1);

		const next = parsed((await canvasStateBlock(CHAT)) ?? "");
		expect(next.canvas.blocks).toHaveLength(1);
		expect(next.since_your_last_turn).toBeUndefined();

		const rows = await db().execute(`select seen_turn from canvas_ops`);
		expect(rows.rows[0].seen_turn).toBe(1);
	});

	it("never marks an op that landed after the block was built", async () => {
		await applyCanvasEntry(
			CHAT,
			{ op: "add_block", block: chart("b_daily") },
			"agent",
		);
		await canvasStateBlock(CHAT);
		// The user drags while the agent is mid-turn.
		await applyCanvasEntry(
			CHAT,
			{ op: "place", id: "b_daily", x: 800 },
			"user",
		);
		await markCanvasOpsSeen(CHAT, 1);

		const next = parsed((await canvasStateBlock(CHAT)) ?? "");
		expect(next.since_your_last_turn).toMatchObject([
			{ op: "place", x: 800, from: { x: 48 } },
		]);
	});

	it("passes a labeled batch through as one delta frame", async () => {
		await applyCanvasEntry(
			CHAT,
			{
				op: "batch",
				label: "lay out the overview",
				ops: [
					{ op: "add_block", block: chart("b_daily") },
					{ op: "place", id: "b_daily", y: 144 },
				],
			},
			"agent",
		);
		const state = parsed((await canvasStateBlock(CHAT)) ?? "");
		expect(state.since_your_last_turn).toMatchObject([
			{ actor: "agent", op: "batch", label: "lay out the overview" },
		]);
	});
});
