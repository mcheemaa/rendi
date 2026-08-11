import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/index";
import { ddApprovals } from "@/lib/db/schema";
import {
	verifyApprovalToken,
	voidApproval,
} from "@/lib/rendi/doordash-approval";
import { setCartStatus } from "@/lib/rendi/doordash-db";

// The card's cancel button: voids an unconsumed approval and reopens
// the cart for editing. A consumed approval already became an order;
// cancelling here must never rewind that cart.

const bodySchema = z.object({ token: z.string().min(1).max(64) });

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
	if (!parsed.success || !verifyApprovalToken(approvalId, parsed.data.token)) {
		return Response.json({ error: "not yours" }, { status: 403 });
	}
	const [row] = await getDb()
		.select({ cartUuid: ddApprovals.cartUuid })
		.from(ddApprovals)
		.where(eq(ddApprovals.id, approvalId));
	if (!row)
		return Response.json({ error: "no such approval" }, { status: 404 });
	// The void itself is the arbiter: if submission consumed the row
	// between any read and now, nothing voids and the cart must not
	// reopen under an order that is already being placed.
	const voided = await voidApproval(approvalId);
	if (!voided) {
		return Response.json({ error: "already used" }, { status: 409 });
	}
	await setCartStatus(row.cartUuid, "open");
	return Response.json({ ok: true });
}
