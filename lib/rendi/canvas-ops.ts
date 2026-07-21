import { z } from "zod";
import {
	type CanvasBlock,
	type CanvasDoc,
	canvasBlock,
	type Frame,
	MIN_H,
	MIN_W,
	SNAP,
} from "./canvas.ts";
import { persistedInstrumentSpec } from "./instrument.ts";

// The closed op vocabulary, one reducer, both hands. place carries any
// subset of the frame so one gesture (a corner resize moving x, y, w, h) is
// one op, and z-order is placement rather than a bespoke verb. Intent stays
// in the actor: "bring the charts to the bottom" is computed placement.

const placeOp = z.object({
	op: z.literal("place"),
	id: z.string(),
	x: z.number().int().optional(),
	y: z.number().int().optional(),
	w: z.number().int().optional(),
	h: z.number().int().optional(),
	z: z.number().int().optional(),
});

const addBlockOp = z.object({
	op: z.literal("add_block"),
	block: canvasBlock,
});

const removeOp = z.object({ op: z.literal("remove"), id: z.string() });

const setContentOp = z.object({
	op: z.literal("set_content"),
	id: z.string(),
	markdown: z.string().optional(),
	html: z.string().optional(),
	prompt: z.string().optional(),
	assetUrl: z.string().optional(),
});

const updateParamsOp = z.object({
	op: z.literal("update_params"),
	id: z.string(),
	values: z.record(z.string(), z.string()),
});

const updateInstrumentOp = z.object({
	op: z.literal("update_instrument"),
	id: z.string(),
	instrument: persistedInstrumentSpec,
});

export const canvasOp = z.discriminatedUnion("op", [
	placeOp,
	addBlockOp,
	removeOp,
	setContentOp,
	updateParamsOp,
	updateInstrumentOp,
]);

export const opBatch = z.object({
	op: z.literal("batch"),
	label: z.string().optional(),
	ops: z.array(canvasOp),
});

export const opEntry = z.union([canvasOp, opBatch]);

export type CanvasOp = z.infer<typeof canvasOp>;
export type PlaceOp = z.infer<typeof placeOp>;
export type OpBatch = z.infer<typeof opBatch>;
export type OpEntry = z.infer<typeof opEntry>;
export type Actor = "user" | "agent";

function snapTo(value: number): number {
	return Math.round(value / SNAP) * SNAP;
}

// The lattice and the minimums are reducer law, not schema law: whatever
// either hand sends, what lands in the document is snapped and sane.
function settleFrame(next: Partial<Frame>, current: Frame): Frame {
	const settled = {
		x: snapTo(next.x ?? current.x),
		y: snapTo(next.y ?? current.y),
		w: Math.max(MIN_W, snapTo(next.w ?? current.w)),
		h: Math.max(MIN_H, snapTo(next.h ?? current.h)),
		z: next.z ?? current.z,
	};
	return settled;
}

function applyOne(doc: CanvasDoc, op: CanvasOp): CanvasDoc {
	switch (op.op) {
		case "place":
			return {
				...doc,
				blocks: doc.blocks.map((block) =>
					block.id === op.id
						? { ...block, frame: settleFrame(op, block.frame) }
						: block,
				),
			};
		case "add_block": {
			const block: CanvasBlock = {
				...op.block,
				frame: settleFrame(op.block.frame, op.block.frame),
			};
			return { ...doc, blocks: [...doc.blocks, block] };
		}
		case "remove":
			return {
				...doc,
				blocks: doc.blocks.filter((block) => block.id !== op.id),
			};
		case "set_content":
			return {
				...doc,
				blocks: doc.blocks.map((block) => {
					if (block.id !== op.id) return block;
					if (block.kind === "text" && op.markdown !== undefined) {
						return { ...block, markdown: op.markdown };
					}
					if (block.kind === "html") {
						return { ...block, html: op.html ?? block.html };
					}
					if (block.kind === "image") {
						return {
							...block,
							prompt: op.prompt ?? block.prompt,
							assetUrl: op.assetUrl ?? block.assetUrl,
						};
					}
					return block;
				}),
			};
		case "update_params":
			return {
				...doc,
				blocks: doc.blocks.map((block) => {
					if (block.id !== op.id || block.kind !== "instrument") return block;
					// Only declared params are steerable; anything else is inert.
					const declared = new Set(
						block.instrument.params.map((param) => param.name),
					);
					const values = Object.fromEntries(
						Object.entries(op.values).filter(([name]) => declared.has(name)),
					);
					return { ...block, paramState: { ...block.paramState, ...values } };
				}),
			};
		case "update_instrument":
			return {
				...doc,
				blocks: doc.blocks.map((block) => {
					if (block.id !== op.id || block.kind !== "instrument") return block;
					// Drop params the new spec retired; default params it
					// introduced. A select keeps its value only if the new
					// options still offer it.
					const paramState = Object.fromEntries(
						op.instrument.params.map((param) => {
							const prior = block.paramState[param.name];
							const keep =
								prior !== undefined &&
								(param.control !== "select" ||
									(param.options ?? []).includes(prior));
							return [param.name, keep ? prior : param.defaultValue];
						}),
					);
					return { ...block, instrument: op.instrument, paramState };
				}),
			};
	}
}

// A batch applies atomically and bumps the version once, so one gesture or
// one agent intent is one frame of history.
export function applyOps(doc: CanvasDoc, entry: OpEntry): CanvasDoc {
	const ops = entry.op === "batch" ? entry.ops : [entry];
	const next = ops.reduce(applyOne, doc);
	return { ...next, version: doc.version + 1 };
}

export function replay(initial: CanvasDoc, entries: OpEntry[]): CanvasDoc {
	return entries.reduce(applyOps, initial);
}
