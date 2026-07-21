import { eq, sql } from "drizzle-orm";
import { getDb } from "../../db/index.ts";
import { canvases, canvasOps } from "../../db/schema.ts";
import { type CanvasDoc, emptyCanvas } from "../canvas.ts";
import {
	type Actor,
	applyOps,
	type CanvasOp,
	type OpEntry,
} from "../canvas-ops.ts";

// The one writer of canvases: the ops route (user hand) and the agent tool
// both land here. Apply and append happen in a single transaction, and the
// materialized doc plus the log stay replay-equivalent by construction.

export type ApplyResult = { doc: CanvasDoc; version: number };

export async function loadCanvas(
	conversationId: string,
): Promise<ApplyResult | undefined> {
	const rows = await getDb()
		.select()
		.from(canvases)
		.where(eq(canvases.conversationId, conversationId));
	const row = rows[0];
	return row ? { doc: row.doc, version: row.version } : undefined;
}

// Before-values ride inside the stored entry so the readback delta can say
// "from" without replaying history: the transaction already holds the doc.
function enrich(doc: CanvasDoc, entry: OpEntry): OpEntry {
	const enrichOne = (op: CanvasOp): CanvasOp => {
		if (op.op === "place") {
			const current = doc.blocks.find((block) => block.id === op.id);
			if (!current) return op;
			const from: Record<string, number> = {};
			for (const key of ["x", "y", "w", "h", "z"] as const) {
				if (op[key] !== undefined) from[key] = current.frame[key];
			}
			return { ...op, from } as CanvasOp;
		}
		if (op.op === "update_params") {
			const current = doc.blocks.find((block) => block.id === op.id);
			if (current?.kind !== "instrument") return op;
			const from: Record<string, string> = {};
			for (const name of Object.keys(op.values)) {
				const prior = current.paramState[name];
				if (prior !== undefined) from[name] = prior;
			}
			return { ...op, from } as CanvasOp;
		}
		return op;
	};
	return entry.op === "batch"
		? { ...entry, ops: entry.ops.map(enrichOne) }
		: enrichOne(entry);
}

// LWW by construction: ops carry absolute values keyed by block, so a
// stale baseVersion rebases by applying onto the current document; the
// caller adopts the returned truth.
export async function applyCanvasEntry(
	conversationId: string,
	entry: OpEntry,
	actor: Actor,
): Promise<ApplyResult> {
	return getDb().transaction(async (tx) => {
		const existing = await tx
			.select()
			.from(canvases)
			.where(eq(canvases.conversationId, conversationId))
			.for("update");
		let row = existing[0];
		if (!row) {
			const created = await tx
				.insert(canvases)
				.values({
					id: crypto.randomUUID(),
					conversationId,
					doc: emptyCanvas(conversationId, "Canvas"),
				})
				.returning();
			row = created[0];
		}
		const enriched = enrich(row.doc, entry);
		const doc = applyOps(row.doc, enriched);
		await tx
			.update(canvases)
			.set({ doc, version: doc.version, updatedAt: sql`now()` })
			.where(eq(canvases.id, row.id));
		await tx.insert(canvasOps).values({
			canvasId: row.id,
			conversationId,
			actor,
			entry: enriched,
		});
		return { doc, version: doc.version };
	});
}
