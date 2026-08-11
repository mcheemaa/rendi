import { runs, tasks } from "@trigger.dev/sdk";
import { z } from "zod";
import { getCartSnapshot } from "@/lib/rendi/doordash-db";
import type { ddCartExec } from "@/trigger/dd-cart-exec";

// The card's touch edits. The dd-cli binary lives in the worker, so the
// route triggers the exec task and waits the run out; the fresh snapshot
// comes back for the card to adopt. Actor is the user by construction:
// this route only ever runs from the browser's hand.

const opSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("set-quantity"),
		lineId: z.string(),
		quantity: z.number().int().min(0).max(50),
	}),
	z.object({ kind: z.literal("remove-line"), lineId: z.string() }),
	z.object({
		kind: z.literal("set-tip"),
		tipCents: z.number().int().min(0).max(50_000),
	}),
	z.object({
		kind: z.literal("set-fulfillment"),
		fulfillment: z.enum(["delivery", "pickup"]),
	}),
	z.object({ kind: z.literal("preview") }),
]);

const POLL_MS = 800;
const DEADLINE_MS = 60_000;

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ uuid: string }> },
) {
	const { uuid } = await params;
	const snapshot = await getCartSnapshot(uuid);
	if (!snapshot) {
		return Response.json({ error: "unknown cart" }, { status: 404 });
	}
	const parsed = opSchema.safeParse(await request.json());
	if (!parsed.success) {
		return Response.json({ error: "malformed op" }, { status: 400 });
	}
	const handle = await tasks.trigger<typeof ddCartExec>("rendi-dd-cart-exec", {
		cartUuid: uuid,
		conversationId: snapshot.conversationId,
		op: parsed.data,
	});
	const startedAt = Date.now();
	while (Date.now() - startedAt < DEADLINE_MS) {
		const run = await runs.retrieve(handle.id);
		if (run.status === "COMPLETED") {
			const fresh = await getCartSnapshot(uuid);
			return Response.json({ ok: true, cart: fresh ?? null });
		}
		if (
			run.status === "FAILED" ||
			run.status === "CRASHED" ||
			run.status === "CANCELED" ||
			run.status === "SYSTEM_FAILURE" ||
			run.status === "TIMED_OUT"
		) {
			return Response.json(
				{ error: "the edit did not go through" },
				{ status: 502 },
			);
		}
		await new Promise((resolve) => setTimeout(resolve, POLL_MS));
	}
	return Response.json({ error: "edit timed out" }, { status: 504 });
}
