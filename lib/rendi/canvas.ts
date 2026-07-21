import { z } from "zod";
import { persistedInstrumentSpec } from "./instrument.ts";

// The canvas document: freeform world coordinates (CSS px at zoom 1) on an
// 8px lattice, unbounded plane, explicit z. The camera is per-viewer session
// state and never appears here. Decided in the 2026-07-20 canvas research.
export const SNAP = 8;
export const MIN_W = 96;
export const MIN_H = 64;

export const frame = z.object({
	x: z.number().int(),
	y: z.number().int(),
	w: z.number().int().min(MIN_W),
	h: z.number().int().min(MIN_H),
	z: z.number().int(),
});

const blockBase = {
	id: z.string(),
	frame,
};

export const canvasBlock = z.discriminatedUnion("kind", [
	z.object({
		...blockBase,
		kind: z.literal("instrument"),
		instrument: persistedInstrumentSpec,
		// Param state lives in the document, so steering a canvas block
		// survives refreshes by construction.
		paramState: z.record(z.string(), z.string()).default({}),
	}),
	z.object({
		...blockBase,
		kind: z.literal("text"),
		markdown: z.string(),
	}),
	z.object({
		...blockBase,
		kind: z.literal("image"),
		prompt: z.string(),
		assetUrl: z.string().nullable().default(null),
	}),
	z.object({
		...blockBase,
		kind: z.literal("html"),
		title: z.string(),
		html: z.string(),
	}),
]);

export const canvasDoc = z.object({
	id: z.string(),
	title: z.string(),
	snap: z.literal(SNAP),
	version: z.number().int().nonnegative(),
	blocks: z.array(canvasBlock),
});

export type Frame = z.infer<typeof frame>;
export type CanvasBlock = z.infer<typeof canvasBlock>;
export type CanvasDoc = z.infer<typeof canvasDoc>;

export function emptyCanvas(id: string, title: string): CanvasDoc {
	return { id, title, snap: SNAP, version: 0, blocks: [] };
}
