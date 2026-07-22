import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { datasets } from "@/lib/db/schema";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
	const { slug } = await params;
	const [row] = await getDb()
		.select({
			slug: datasets.slug,
			status: datasets.status,
			rowsLoaded: datasets.rowsLoaded,
			rowsEstimate: datasets.rowsEstimate,
			error: datasets.error,
			updatedAt: datasets.updatedAt,
		})
		.from(datasets)
		.where(eq(datasets.slug, slug))
		.limit(1);
	if (!row) return Response.json(null);
	const { updatedAt, ...state } = row;
	// Age computed server-side; a live ingest bumps the row every two
	// seconds, so staleness here means the run died without a trace.
	return Response.json({
		...state,
		updatedAgoMs: Date.now() - updatedAt.getTime(),
	});
}
