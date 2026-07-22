import { getTranscript } from "@/lib/db/queries";

type Params = { params: Promise<{ id: string }> };

// Open tabs poll this to catch turns they did not start (pulse beats,
// dataset-ready nudges); the payload is the same persisted transcript
// the page loads on refresh.
export async function GET(_request: Request, { params }: Params) {
	const { id } = await params;
	const messages = await getTranscript(id);
	return Response.json(
		{ messages },
		{ headers: { "cache-control": "no-store" } },
	);
}
