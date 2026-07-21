import { z } from "zod";
import { opEntry } from "@/lib/rendi/canvas-ops";
import { applyCanvasEntry, loadCanvas } from "@/lib/rendi/harness/canvas-db";

const applyRequest = z.object({
	baseVersion: z.number().int().nonnegative(),
	entry: opEntry,
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
	const { id } = await params;
	const canvas = await loadCanvas(id);
	// Absence is a state, not an error: the canvas exists from first use.
	return Response.json(canvas ?? null);
}

// The browser's hand. Actor is forced here, never trusted from the client;
// the agent's hand enters through its tool, into the same writer.
export async function POST(request: Request, { params }: Params) {
	const { id } = await params;
	const body = await request.json().catch(() => null);
	const parsed = applyRequest.safeParse(body);
	if (!parsed.success) {
		return Response.json({ error: "malformed canvas entry" }, { status: 400 });
	}
	// baseVersion is informational under LWW-by-construction: a stale client
	// rebases by adopting the returned truth.
	const result = await applyCanvasEntry(id, parsed.data.entry, "user");
	return Response.json(result);
}
