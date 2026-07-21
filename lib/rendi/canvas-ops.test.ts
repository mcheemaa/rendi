import { describe, expect, it } from "vitest";
import { type CanvasBlock, type CanvasDoc, emptyCanvas } from "./canvas.ts";
import { applyOps, type OpEntry, replay } from "./canvas-ops.ts";

function note(id: string, x = 48, y = 48): CanvasBlock {
	return {
		id,
		kind: "text",
		frame: { x, y, w: 320, h: 160, z: 1 },
		markdown: "note",
	};
}

function instrument(id: string): CanvasBlock {
	return {
		id,
		kind: "instrument",
		frame: { x: 48, y: 48, w: 560, h: 320, z: 1 },
		instrument: {
			title: "Daily commits",
			sql: "SELECT 1",
			params: [],
		},
		paramState: { window: "30d" },
	};
}

function seed(...blocks: CanvasBlock[]): CanvasDoc {
	return { ...emptyCanvas("cnv-1", "Board"), blocks };
}

describe("the reducer", () => {
	it("settles any placement onto the lattice with sane minimums", () => {
		const doc = applyOps(seed(note("a")), {
			op: "place",
			id: "a",
			x: 101,
			y: 47,
			w: 50,
			h: 10,
		});
		expect(doc.blocks[0].frame).toEqual({ x: 104, y: 48, w: 96, h: 64, z: 1 });
	});

	it("places any subset of the frame, z included", () => {
		const doc = applyOps(seed(note("a")), { op: "place", id: "a", z: 5 });
		expect(doc.blocks[0].frame).toEqual({ x: 48, y: 48, w: 320, h: 160, z: 5 });
	});

	it("tolerates unknown ids without dying", () => {
		const before = seed(note("a"));
		const doc = applyOps(before, { op: "place", id: "ghost", x: 0 });
		expect(doc.blocks).toEqual(before.blocks);
		expect(doc.version).toBe(1);
	});

	it("snaps an added block onto the lattice", () => {
		const off = { ...note("b"), frame: { x: 13, y: 21, w: 205, h: 101, z: 2 } };
		const doc = applyOps(seed(), { op: "add_block", block: off });
		expect(doc.blocks[0].frame).toEqual({
			x: 16,
			y: 24,
			w: 208,
			h: 104,
			z: 2,
		});
	});

	it("bumps the version once per batch, atomically", () => {
		const doc = applyOps(seed(note("a"), note("b", 400, 48)), {
			op: "batch",
			label: "bring all charts to the bottom",
			ops: [
				{ op: "place", id: "a", y: 800 },
				{ op: "place", id: "b", y: 800 },
			],
		});
		expect(doc.version).toBe(1);
		expect(doc.blocks.map((block) => block.frame.y)).toEqual([800, 800]);
	});

	it("routes set_content by kind", () => {
		const image: CanvasBlock = {
			id: "img",
			kind: "image",
			frame: { x: 48, y: 48, w: 320, h: 240, z: 1 },
			prompt: "amber dawn",
			assetUrl: null,
		};
		const doc = applyOps(seed(image), {
			op: "set_content",
			id: "img",
			assetUrl: "https://blob.example/dawn.png",
		});
		const block = doc.blocks[0];
		expect(block.kind === "image" && block.assetUrl).toBe(
			"https://blob.example/dawn.png",
		);
	});

	it("merges steering into an instrument block's document state", () => {
		const doc = applyOps(seed(instrument("i1")), {
			op: "update_params",
			id: "i1",
			values: { window: "7d" },
		});
		const block = doc.blocks[0];
		expect(block.kind === "instrument" && block.paramState).toEqual({
			window: "7d",
		});
	});

	it("replaces an instrument spec through update_instrument", () => {
		const doc = applyOps(seed(instrument("i1")), {
			op: "update_instrument",
			id: "i1",
			instrument: { title: "Hourly commits", sql: "SELECT 2", params: [] },
		});
		const block = doc.blocks[0];
		expect(block.kind === "instrument" && block.instrument.title).toBe(
			"Hourly commits",
		);
	});
});

describe("replay", () => {
	it("rebuilds the exact document from the log", () => {
		const initial = seed(note("a"), instrument("i1"));
		const log: OpEntry[] = [
			{ op: "place", id: "a", x: 400, y: 720 },
			{ op: "update_params", id: "i1", values: { window: "7d" } },
			{
				op: "batch",
				ops: [
					{ op: "place", id: "i1", w: 664, h: 392 },
					{
						op: "add_block",
						block: {
							...note("b"),
							frame: { x: 720, y: 48, w: 320, h: 160, z: 3 },
						},
					},
				],
			},
			{ op: "remove", id: "a" },
		];
		const stepped = log.reduce(applyOps, initial);
		expect(replay(initial, log)).toEqual(stepped);
		expect(stepped.version).toBe(4);
		expect(stepped.blocks.map((block) => block.id)).toEqual(["i1", "b"]);
	});
});
