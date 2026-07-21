import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { images } from "@/lib/db/schema";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
	const { id } = await params;
	const db = getDb();
	const [row] = await db
		.select({ mime: images.mime, data: images.data })
		.from(images)
		.where(eq(images.id, id))
		.limit(1);
	if (!row) return new Response("Not found", { status: 404 });
	return new Response(Buffer.from(row.data, "base64"), {
		headers: {
			"Content-Type": row.mime,
			"Cache-Control": "public, max-age=31536000, immutable",
		},
	});
}
