import type { drizzle } from "drizzle-orm/pglite";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CanvasBlock, CanvasDoc } from "../canvas.ts";
import { emptyCanvas } from "../canvas.ts";
import { type OpEntry, replay } from "../canvas-ops.ts";
import { applyCanvasEntry, loadCanvas } from "./canvas-db.ts";
import { createTestDb } from "./test-db.ts";

const holder = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("../../db/index.ts", () => ({
	getDb: () => holder.db,
}));

const CHAT = "canvas-chat";

function db() {
	return holder.db as ReturnType<typeof drizzle>;
}

function note(id: string): CanvasBlock {
	return {
		id,
		kind: "text",
		frame: { x: 48, y: 48, w: 320, h: 160, z: 1 },
		markdown: "note",
	};
}

beforeEach(async () => {
	holder.db = await createTestDb();
	await db().execute(`insert into conversations (id) values ('${CHAT}')`);
});

describe("applyCanvasEntry", () => {
	it("creates the canvas on first write and persists the applied doc", async () => {
		const result = await applyCanvasEntry(
			CHAT,
			{ op: "add_block", block: note("a") },
			"agent",
		);
		expect(result.version).toBe(1);
		expect(result.doc.blocks).toHaveLength(1);

		const loaded = await loadCanvas(CHAT);
		expect(loaded?.doc).toEqual(result.doc);
	});

	it("stamps the actor and enriches place ops with before-values", async () => {
		await applyCanvasEntry(
			CHAT,
			{ op: "add_block", block: note("a") },
			"agent",
		);
		await applyCanvasEntry(
			CHAT,
			{ op: "place", id: "a", x: 400, y: 720 },
			"user",
		);

		const ops = await db().execute(
			`select actor, entry from canvas_ops order by id`,
		);
		expect(ops.rows[0].actor).toBe("agent");
		expect(ops.rows[1].actor).toBe("user");
		expect(ops.rows[1].entry).toMatchObject({
			op: "place",
			id: "a",
			x: 400,
			y: 720,
			from: { x: 48, y: 48 },
		});
	});

	it("enriches steers with the prior param values", async () => {
		const block: CanvasBlock = {
			id: "i1",
			kind: "instrument",
			frame: { x: 48, y: 48, w: 560, h: 320, z: 1 },
			instrument: { title: "Daily", sql: "SELECT 1", params: [] },
			paramState: { window: "30d" },
		};
		await applyCanvasEntry(CHAT, { op: "add_block", block }, "agent");
		await applyCanvasEntry(
			CHAT,
			{ op: "update_params", id: "i1", values: { window: "7d" } },
			"user",
		);

		const ops = await db().execute(
			`select entry from canvas_ops order by id desc limit 1`,
		);
		expect(ops.rows[0].entry).toMatchObject({
			op: "update_params",
			from: { window: "30d" },
		});
	});

	it("keeps the materialized doc replay-equivalent to the log", async () => {
		await applyCanvasEntry(
			CHAT,
			{ op: "add_block", block: note("a") },
			"agent",
		);
		await applyCanvasEntry(CHAT, { op: "place", id: "a", x: 640 }, "user");
		await applyCanvasEntry(
			CHAT,
			{
				op: "batch",
				label: "arrange",
				ops: [
					{ op: "add_block", block: note("b") },
					{ op: "place", id: "b", y: 400 },
				],
			},
			"agent",
		);

		const ops = await db().execute(`select entry from canvas_ops order by id`);
		const replayed = replay(
			emptyCanvas(CHAT, "Canvas"),
			ops.rows.map((row) => row.entry as OpEntry),
		);
		const stored = (await loadCanvas(CHAT)) as { doc: CanvasDoc };
		expect(stored.doc).toEqual(replayed);
	});
});
