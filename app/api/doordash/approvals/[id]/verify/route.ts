import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/index";
import { ddApprovals } from "@/lib/db/schema";
import { verifyApproval } from "@/lib/rendi/doordash-approval";
import { sendSessionText } from "@/lib/rendi/nudge";

// The code's only door. Deterministic verification, no model anywhere
// in the path; on success the session inbox wakes the agent, the
// three-writers pattern doing what it was born for.

const bodySchema = z.object({ code: z.string().min(1).max(12) });

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const approvalId = Number(id);
	if (!Number.isInteger(approvalId)) {
		return Response.json({ error: "bad approval" }, { status: 400 });
	}
	const parsed = bodySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return Response.json({ error: "bad code" }, { status: 400 });
	}
	const result = await verifyApproval(approvalId, parsed.data.code);
	if (!result.ok) {
		return Response.json(result, { status: 400 });
	}
	const [row] = await getDb()
		.select({ conversationId: ddApprovals.conversationId })
		.from(ddApprovals)
		.where(eq(ddApprovals.id, approvalId));
	if (row) {
		await sendSessionText(
			row.conversationId,
			`[order approved, approval ${approvalId}] The owner entered the code. Place the order with doordash-submit.`,
		);
	}
	return Response.json({ ok: true });
}
