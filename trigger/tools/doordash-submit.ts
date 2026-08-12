import { tool } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/index";
import { type DdCartRow, ddCarts, ddOrders } from "@/lib/db/schema";
import * as dd from "@/lib/rendi/doordash";
import {
	consumeApproval,
	hashCart,
	reserveOrderSlot,
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

async function knownOrderUuids(): Promise<Set<string>> {
	return new Set(
		(await getDb().select({ orderUuid: ddOrders.orderUuid }).from(ddOrders))
			.map((row) => row.orderUuid)
			.filter((uuid): uuid is string => Boolean(uuid)),
	);
}

// Poll an accepted order to a terminal state, bounded, and leave the
// ledger and cart telling the same story.
async function settleOrder(
	orderRowId: number,
	orderUuid: string,
	cartUuid: string,
	goal: string,
): Promise<{ status: string; errorMessage: string | null }> {
	let status = "pending";
	let errorMessage: string | null = null;
	for (let attempt = 0; attempt < STATUS_POLLS; attempt++) {
		const check = await dd.orderStatus(orderUuid, goal).catch(() => null);
		if (check) {
			status = check.status;
			errorMessage = check.error_message ?? null;
			if (status !== "pending") break;
		}
		await new Promise((resolve) => setTimeout(resolve, STATUS_POLL_MS));
	}
	await recordOutcome(orderRowId, { status, errorMessage });
	await setCartStatus(
		cartUuid,
		status === "successful"
			? "placed"
			: status === "pending"
				? "placing"
				: "failed",
	);
	return { status, errorMessage };
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
			if (!existing) return { refused: "the approval was already used" };
			// A recorded pending or unknown outcome may have resolved since;
			// ask DoorDash before repeating stale news.
			if (
				(existing.status === "pending" || existing.status === "unknown") &&
				existing.orderUuid
			) {
				const check = await dd
					.orderStatus(existing.orderUuid, goal)
					.catch(() => null);
				if (check) {
					await recordOutcome(existing.id, {
						status: check.status,
						errorMessage: check.error_message ?? null,
					});
					await setCartStatus(
						existing.cartUuid,
						check.status === "successful"
							? "placed"
							: check.status === "pending"
								? "placing"
								: "failed",
					);
					return {
						outcome: check.status,
						orderUuid: existing.orderUuid,
						note: "this approval was already used; this is the live status",
					};
				}
			}
			// Unknown with no uuid is the timed-out submit whose truth was
			// still unwritten. Re-calling this tool IS the settle loop: adopt
			// the order if history shows one landed, release the cart once a
			// successful look confirms nothing ever did.
			if (existing.status === "unknown" && !existing.orderUuid) {
				const snapshot = await getCartSnapshot(existing.cartUuid);
				if (snapshot) {
					const rec = await dd.findUnrecordedOrder(
						snapshot.storeId,
						await knownOrderUuids(),
						goal,
					);
					if ("unavailable" in rec) {
						return {
							outcome: "unknown",
							note: "order history is unreachable right now; the cart stays sealed, try this same approval id again shortly",
						};
					}
					if (rec.found) {
						await recordOutcome(existing.id, { orderUuid: rec.found });
						const settled = await settleOrder(
							existing.id,
							rec.found,
							existing.cartUuid,
							goal,
						);
						return {
							outcome: settled.status,
							orderUuid: rec.found,
							...(settled.errorMessage ? { error: settled.errorMessage } : {}),
							note: "the lost submission had landed after all; this is its live status",
						};
					}
					await recordOutcome(existing.id, {
						status: "failed",
						errorMessage: "no order ever appeared in history",
					});
					await setCartStatus(existing.cartUuid, "open");
					return {
						outcome: "failed",
						note: "nothing ever landed at DoorDash; the cart is open again, request a fresh approval when ready",
					};
				}
			}
			return {
				outcome: existing.status,
				orderUuid: existing.orderUuid,
				note: "this approval was already used; that outcome stands",
			};
		}
		const approval = consumed.consumed;
		// Seal the cart the moment the approval is spent: from here to the
		// outcome, both hands are off, and the ops layer refuses mutations
		// against placing carts so nothing can drift mid-submission.
		await setCartStatus(approval.cartUuid, "placing");

		// Everything before the charge can crash (the CLI, the database);
		// a pre-flight failure must never strand a sealed cart with a spent
		// approval and no order row.
		let prepared:
			| { snapshot: DdCartRow; orderRowId: number; sealStamp: Date }
			| undefined;
		try {
			const snapshot = await getCartSnapshot(approval.cartUuid);
			if (!snapshot) {
				await setCartStatus(approval.cartUuid, "open");
				return { refused: "the cart is gone" };
			}

			// The tip lives in our snapshot, not at DoorDash, so the cart
			// hash cannot see it move; compare it directly. The email
			// promised any change voids the code, and the tip is a change.
			if (snapshot.tipCents !== approval.tipCents) {
				await voidApproval(approvalId);
				await setCartStatus(approval.cartUuid, "voided");
				return {
					voided:
						"the tip changed after the code was sent; request a fresh approval",
				};
			}

			// Revalidate against live truth: the owner approved a frozen
			// cart, so any drift since the email voids the approval.
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
			// leaves an honest pending record instead of a silent maybe; the
			// reservation is atomic so racing approvals cannot double-spend
			// the last daily slot.
			const slot = await reserveOrderSlot({
				approvalId,
				conversationId: approval.conversationId,
				cartUuid: approval.cartUuid,
				storeName: snapshot.storeName,
				totalCents: approval.totalCents,
			});
			if ("denied" in slot) {
				await setCartStatus(approval.cartUuid, "open");
				return {
					refused: `${slot.denied}; this approval is spent either way`,
				};
			}
			// The seal write preceded this snapshot read, so its updatedAt
			// is the seal-time stamp every later write would move.
			prepared = {
				snapshot,
				orderRowId: slot.orderId,
				sealStamp: snapshot.updatedAt,
			};
		} catch (error) {
			await setCartStatus(approval.cartUuid, "open");
			return {
				refused: `the pre-flight failed before anything was charged (${
					error instanceof Error ? error.message : "unknown error"
				}); this approval is spent, ask for a fresh one`,
			};
		}
		if (!prepared) return { refused: "the pre-flight never completed" };
		const { snapshot, orderRowId } = prepared;
		const orderRow = { id: orderRowId };

		// Last look before money: any write since the seal means a mutation
		// slipped past it while the pre-flight CLI calls were in the air.
		// The residual window is the submit call itself, which no caller
		// outside DoorDash can make atomic.
		const [stamp] = await getDb()
			.select({ updatedAt: ddCarts.updatedAt })
			.from(ddCarts)
			.where(eq(ddCarts.cartUuid, approval.cartUuid));
		if (!stamp || stamp.updatedAt.getTime() !== prepared.sealStamp.getTime()) {
			await recordOutcome(orderRow.id, {
				status: "aborted",
				errorMessage: "the cart changed during submission",
			});
			await setCartStatus(approval.cartUuid, "open");
			return {
				voided:
					"the cart changed during submission; nothing was charged, request a fresh approval",
			};
		}

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
				const rec = await dd.findUnrecordedOrder(
					snapshot.storeId,
					await knownOrderUuids(),
					goal,
				);
				if ("found" in rec && rec.found) {
					orderUuid = rec.found;
				} else {
					await recordOutcome(orderRow.id, {
						status: "unknown",
						errorMessage: error.message,
					});
					// The cart stays sealed: an immediate miss proves nothing,
					// since creation can lag a timed-out submit and the history
					// call itself can fail. The settle loop above releases it.
					return {
						outcome: "unknown",
						storeName: snapshot.storeName,
						error: error.message,
						note: "the submission may or may not have reached DoorDash; the cart stays sealed and nothing else may be ordered. Wait a minute, then call doordash-submit again with this same approval id: it settles against order history, adopting the order if it landed or reopening the cart if it never did.",
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
			({ status, errorMessage } = await settleOrder(
				orderRow.id,
				orderUuid,
				approval.cartUuid,
				goal,
			));
		} else {
			await recordOutcome(orderRow.id, { status, errorMessage });
		}
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
