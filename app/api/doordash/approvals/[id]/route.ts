import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db/index";
import { ddApprovals } from "@/lib/db/schema";
import { verifyApprovalToken } from "@/lib/rendi/doordash-approval";

export type ApprovalStatus =
	| "waiting"
	| "verified"
	| "consumed"
	| "voided"
	| "expired";

// The card re-renders from the transcript on every reload, so it asks
// the row where things actually stand before offering a code input.
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params;
	const approvalId = Number(id);
	if (!Number.isInteger(approvalId)) {
		return Response.json({ error: "bad approval" }, { status: 400 });
	}
	const token = new URL(request.url).searchParams.get("token");
	if (!verifyApprovalToken(approvalId, token)) {
		return Response.json({ error: "not yours" }, { status: 403 });
	}
	const [row] = await getDb()
		.select({
			consumedAt: ddApprovals.consumedAt,
			voidedAt: ddApprovals.voidedAt,
			verifiedAt: ddApprovals.verifiedAt,
			expiresAt: ddApprovals.expiresAt,
		})
		.from(ddApprovals)
		.where(eq(ddApprovals.id, approvalId));
	if (!row)
		return Response.json({ error: "no such approval" }, { status: 404 });
	const status: ApprovalStatus = row.consumedAt
		? "consumed"
		: row.voidedAt
			? "voided"
			: row.verifiedAt
				? "verified"
				: row.expiresAt.getTime() < Date.now()
					? "expired"
					: "waiting";
	return Response.json({ status, expiresAt: row.expiresAt.toISOString() });
}
