import { tool } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/index";
import { ddOrders } from "@/lib/db/schema";
import * as dd from "@/lib/rendi/doordash";
import {
	consumeApproval,
	hashCart,
	totalWithTip,
	voidApproval,
} from "@/lib/rendi/doordash-approval";
import { normalizeCartLines, normalizeQuote } from "@/lib/rendi/doordash-cart";
import { getCartSnapshot, setCartStatus } from "@/lib/rendi/doordash-db";
import { emitSpan, turnContext } from "@/lib/rendi/harness/telemetry";

const STATUS_POLLS = 8;
const STATUS_POLL_MS = 5_000;

async function recordOutcome(
	orderId: number,
	patch: Partial<{
		orderUuid: string | null;
		status: string;
		errorMessage: string | null;
	}>,
): Promise<void> {
	await getDb()
		.update(ddOrders)
		.set({ ...patch, updatedAt: new Date() })
		.where(eq(ddOrders.id, orderId));
}

// After an uncertain submit, order history is the truth: an order at
// this store that our ledger has never seen is the one whose response
// was lost. Returns its uuid, or null when nothing landed.
async function reconcileFromHistory(
	storeId: string,
	goal: string,
): Promise<string | null> {
	const history = await dd
		.orderHistory({ max: 5, days: 1 }, goal)
		.catch(() => null);
	if (!history) return null;
	const known = new Set(
		(await getDb().select({ orderUuid: ddOrders.orderUuid }).from(ddOrders))
			.map((row) => row.orderUuid)
			.filter(Boolean),
	);
	const found = history.orders.find(
		(order) =>
			String(order.store_id ?? "") === storeId && !known.has(order.order_uuid),
	);
	return found?.order_uuid ?? null;
}

// The finalizer, with zero degrees of freedom: everything about the
// order is frozen in the approval row the owner's code verified. The
// tool consumes the row once; a re-fired turn reads the recorded
// outcome instead of charging twice, which is our answer to an API
// with no idempotency of its own.
export const doordashSubmit = tool({
	description:
		"Place the approved order. Takes only the approval id from the [order approved] wake message; the cart, tip, and total are frozen in the approval the owner verified. Refuses anything unverified, expired, already used, or changed since the code was sent. Never call this on your own initiative; only after an [order approved] message names the approval.",
	inputSchema: z.object({
		approvalId: z.number().int(),
		goal: z
			.string()
			.describe("The original order ask, verbatim, for the audit trail"),
	}),
	execute: async ({ approvalId, goal }) => {
		const turn = turnContext();
		const consumed = await consumeApproval(approvalId);
		if ("refused" in consumed) return { refused: consumed.refused };
		if ("alreadyConsumed" in consumed) {
			const [existing] = await getDb()
				.select()
				.from(ddOrders)
				.where(eq(ddOrders.approvalId, approvalId));
			return existing
				? {
						outcome: existing.status,
						orderUuid: existing.orderUuid,
						note: "this approval was already used; that outcome stands",
					}
				: { refused: "the approval was already used" };
		}
		const approval = consumed.consumed;
		const snapshot = await getCartSnapshot(approval.cartUuid);
		if (!snapshot) return { refused: "the cart is gone" };

		// The tip lives in our snapshot, not at DoorDash, so the cart hash
		// cannot see it move; compare it directly. The email promised any
		// change voids the code, and the tip is a change.
		if (snapshot.tipCents !== approval.tipCents) {
			await voidApproval(approvalId);
			await setCartStatus(approval.cartUuid, "voided");
			return {
				voided:
					"the tip changed after the code was sent; request a fresh approval",
			};
		}

		// Revalidate against live truth: the owner approved a frozen cart,
		// so any drift since the email voids the approval, honestly.
		const shown = await dd.cartShow(approval.cartUuid, goal);
		const preview = await dd.orderPreview(
			{ cartUuid: approval.cartUuid },
			goal,
		);
		const items = normalizeCartLines(shown.cart ?? null);
		const quote = normalizeQuote(preview);
		const liveTotal = quote ? totalWithTip(quote, approval.tipCents) : null;
		const liveHash = hashCart({
			items,
			totalCents: liveTotal ?? -1,
			tipCents: approval.tipCents,
			fulfillment: snapshot.fulfillment,
		});
		if (liveHash !== approval.cartHash) {
			await voidApproval(approvalId);
			await setCartStatus(approval.cartUuid, "voided");
			return {
				voided:
					"the cart changed after the code was sent; request a fresh approval",
			};
		}

		// The order row lands BEFORE the charge, so a crash mid-submit
		// leaves an honest pending record instead of a silent maybe.
		const [orderRow] = await getDb()
			.insert(ddOrders)
			.values({
				approvalId,
				conversationId: approval.conversationId,
				cartUuid: approval.cartUuid,
				storeName: snapshot.storeName,
				totalCents: approval.totalCents,
				status: "pending",
			})
			.returning({ id: ddOrders.id });
		await setCartStatus(approval.cartUuid, "placing");

		let orderUuid: string | null = null;
		try {
			const submitted = await dd.orderSubmit(
				{
					cartUuid: approval.cartUuid,
					tipCents: approval.tipCents,
					fulfillment: snapshot.fulfillment,
				},
				goal,
			);
			orderUuid = submitted.order_uuid ?? null;
		} catch (error) {
			// A lost response is not a rejection: DoorDash may have accepted
			// and charged before the transport died. Only a structured error
			// from the CLI proves the order was refused.
			if (error instanceof dd.DdUncertainError) {
				orderUuid = await reconcileFromHistory(snapshot.storeId, goal);
				if (!orderUuid) {
					await recordOutcome(orderRow.id, {
						status: "unknown",
						errorMessage: error.message,
					});
					return {
						outcome: "unknown",
						storeName: snapshot.storeName,
						error: error.message,
						note: "the submission may or may not have reached DoorDash; never resubmit and never check out elsewhere until order history answers. Check the order history in a minute and reconcile honestly.",
					};
				}
			} else {
				await recordOutcome(orderRow.id, {
					status: "failed",
					errorMessage:
						error instanceof Error ? error.message : "submit failed",
				});
				await setCartStatus(approval.cartUuid, "failed");
				return {
					outcome: "failed",
					error: error instanceof Error ? error.message : "submit failed",
					note: "never resubmit; the browser checkout is the fallback",
				};
			}
		}
		await recordOutcome(orderRow.id, { orderUuid });

		// Acceptance is not creation: poll to a terminal state, bounded.
		let status = "pending";
		let errorMessage: string | null = null;
		if (orderUuid) {
			for (let attempt = 0; attempt < STATUS_POLLS; attempt++) {
				const check = await dd.orderStatus(orderUuid, goal);
				status = check.status;
				errorMessage = check.error_message ?? null;
				if (status !== "pending") break;
				await new Promise((resolve) => setTimeout(resolve, STATUS_POLL_MS));
			}
		}
		await recordOutcome(orderRow.id, { status, errorMessage });
		await setCartStatus(
			approval.cartUuid,
			status === "successful"
				? "placed"
				: status === "pending"
					? "placing"
					: "failed",
		);
		emitSpan({
			conversationId: approval.conversationId,
			turn: turn?.turn ?? 0,
			runId: turn?.runId,
			parentSpanId: turn?.spanId,
			spanKind: "doordash",
			name: "order-submit",
			input: snapshot.storeName,
			output: { status, totalCents: approval.totalCents },
			durationMs: 0,
		});
		return {
			outcome: status,
			orderUuid,
			totalCents: approval.totalCents,
			storeName: snapshot.storeName,
			...(errorMessage ? { error: errorMessage } : {}),
			...(status === "pending"
				? { note: "still processing; check status again shortly" }
				: {}),
			...(status === "failed" || status === "action_required"
				? { note: "never resubmit; the app or browser checkout finishes this" }
				: {}),
		};
	},
});
