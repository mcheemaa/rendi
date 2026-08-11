import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/index";
import { ddApprovals } from "@/lib/db/schema";
import {
	verifyApproval,
	verifyApprovalToken,
} from "@/lib/rendi/doordash-approval";
import { sendSessionText } from "@/lib/rendi/nudge";

// The code's only door. Deterministic verification, no model anywhere
// in the path; on success the session inbox wakes the agent, the
// three-writers pattern doing what it was born for. The capability
// token proves the caller holds this conversation's card, so another
// gate holder cannot burn attempts on someone else's approval.

const bodySchema = z.object({
	code: z.string().min(1).max(12),
	token: z.string().min(1).max(64),
});

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
		return Response.json({ error: "bad request" }, { status: 400 });
	}
	if (!verifyApprovalToken(approvalId, parsed.data.token)) {
		return Response.json({ error: "not yours" }, { status: 403 });
	}
	const result = await verifyApproval(approvalId, parsed.data.code);
	if (!result.ok) {
		return Response.json(result, { status: 400 });
	}
	const [row] = await getDb()
		.select({ conversationId: ddApprovals.conversationId })
		.from(ddApprovals)
		.where(eq(ddApprovals.id, approvalId));
	// The row is already verified; losing the wake must not lose the
	// approval, so the bell rings up to three times and the card is told
	// honestly when nobody answered.
	let woke = false;
	if (row) {
		for (let attempt = 0; attempt < 3 && !woke; attempt++) {
			try {
				await sendSessionText(
					row.conversationId,
					`[order approved, approval ${approvalId}] The owner entered the code. Place the order with doordash-submit.`,
				);
				woke = true;
			} catch {
				await new Promise((resolve) =>
					setTimeout(resolve, 300 * (attempt + 1)),
				);
			}
		}
	}
	return Response.json({ ok: true, woke });
}
