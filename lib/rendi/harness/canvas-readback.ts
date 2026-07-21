import { and, asc, eq, isNull, lte } from "drizzle-orm";
import { getDb } from "../../db/index.ts";
import { canvasOps } from "../../db/schema.ts";
import type { CanvasBlock } from "../canvas.ts";
import { loadCanvas } from "./canvas-db.ts";

// Property 4 extended to layout: the agent opens its turn with the board's
// current arrangement and every change since it last looked, tagged by
// actor. Entries were enriched with before-values at apply time, so this
// stays a pure projection.

function summarize(block: CanvasBlock) {
	const frame = {
		x: block.frame.x,
		y: block.frame.y,
		w: block.frame.w,
		h: block.frame.h,
		z: block.frame.z,
	};
	switch (block.kind) {
		case "instrument":
			return {
				id: block.id,
				kind: block.kind,
				...frame,
				title: block.instrument.title,
				params: block.paramState,
			};
		case "text":
			return {
				id: block.id,
				kind: block.kind,
				...frame,
				preview: block.markdown.slice(0, 80),
			};
		case "image":
			return {
				id: block.id,
				kind: block.kind,
				...frame,
				prompt: block.prompt,
				generated: block.assetUrl !== null,
			};
		case "html":
			return { id: block.id, kind: block.kind, ...frame, title: block.title };
	}
}

// Same single-turn-per-worker carrier the instrument readback documents.
let injected: { chatId: string; through: number } | undefined;

export async function canvasStateBlock(
	chatId: string,
): Promise<string | undefined> {
	const canvas = await loadCanvas(chatId);
	if (!canvas || canvas.doc.blocks.length === 0) {
		injected = undefined;
		return undefined;
	}
	const unseen = await getDb()
		.select()
		.from(canvasOps)
		.where(
			and(eq(canvasOps.conversationId, chatId), isNull(canvasOps.seenTurn)),
		)
		.orderBy(asc(canvasOps.id));
	injected = { chatId, through: unseen.at(-1)?.id ?? 0 };

	const payload = {
		canvas: {
			title: canvas.doc.title,
			snap: canvas.doc.snap,
			version: canvas.version,
			blocks: canvas.doc.blocks.map(summarize),
		},
		...(unseen.length > 0
			? {
					since_your_last_turn: unseen.map((op) => ({
						seq: op.id,
						actor: op.actor,
						...op.entry,
					})),
				}
			: {}),
	};
	return `<canvas_state>\n${JSON.stringify(payload, null, 1)}\n</canvas_state>`;
}

export async function markCanvasOpsSeen(
	chatId: string,
	turn: number,
): Promise<void> {
	const marker = injected;
	injected = undefined;
	if (!marker || marker.chatId !== chatId || marker.through === 0) return;
	await getDb()
		.update(canvasOps)
		.set({ seenTurn: turn })
		.where(
			and(
				eq(canvasOps.conversationId, chatId),
				isNull(canvasOps.seenTurn),
				lte(canvasOps.id, marker.through),
			),
		);
}
