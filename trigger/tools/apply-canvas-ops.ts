import { tool } from "ai";
import { z } from "zod";
import { canvasOp } from "@/lib/rendi/canvas-ops";
import { applyCanvasEntry } from "@/lib/rendi/harness/canvas-db";
import { turnContext } from "@/lib/rendi/harness/telemetry";

export const applyCanvasOps = tool({
	description:
		"Arrange this conversation's canvas, the board the user sees beside the chat. Send one or more ops; several ops land as one atomic batch with your label as its history frame. Coordinates are world pixels snapped to an 8px lattice; z is paint order and overlap is legal. You invent block ids (short, stable, like b_daily). The result echoes the new document version and block count.",
	inputSchema: z.object({
		label: z
			.string()
			.optional()
			.describe(
				"The human phrase for a multi-op intent, e.g. 'lay out the overview'",
			),
		ops: z.array(canvasOp).min(1),
	}),
	execute: async ({ label, ops }) => {
		const turn = turnContext();
		if (!turn) throw new Error("apply-canvas-ops outside a turn");
		const entry =
			ops.length === 1 ? ops[0] : { op: "batch" as const, label, ops };
		const { doc, version } = await applyCanvasEntry(
			turn.conversationId,
			entry,
			"agent",
		);
		return {
			version,
			blocks: doc.blocks.map((block) => ({
				id: block.id,
				kind: block.kind,
				x: block.frame.x,
				y: block.frame.y,
				w: block.frame.w,
				h: block.frame.h,
				z: block.frame.z,
			})),
		};
	},
});
