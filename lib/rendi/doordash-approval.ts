import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { and, count, eq, gt, isNull, sql } from "drizzle-orm";
import { getDb } from "../db/index.ts";
import { type DdApprovalRow, ddApprovals, ddOrders } from "../db/schema.ts";
import type { DdCartLine, DdQuoteSnapshot } from "./doordash-cart.ts";

// The approval machine. A single-use row, hash-bound to the exact
// previewed cart, satisfiable only by a code from the owner's inbox.
// The code never persists and never enters a transcript; possession of
// the inbox is the authorization.

const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

// Number("") is 0 and Number("junk") is NaN; a copied template with
// blank values must mean the defaults, never a zero-dollar ceiling.
function envInt(name: string, fallback: number): number {
	const raw = process.env[name]?.trim();
	if (!raw) return fallback;
	const value = Number(raw);
	return Number.isFinite(value) ? value : fallback;
}

export function maxOrderCents(): number {
	return envInt("DD_MAX_ORDER_CENTS", 10_000);
}

export function maxOrdersPerDay(): number {
	return envInt("DD_MAX_ORDERS_PER_DAY", 3);
}

// Twenty strangers with gate codes must not be able to bomb the owner's
// inbox: requests are capped per conversation per hour and globally per
// day. The daily budget is env-tunable for a challenge window.
const APPROVALS_PER_CONVERSATION_HOUR = 3;

export function maxApprovalsPerDay(): number {
	return envInt("DD_MAX_APPROVALS_PER_DAY", 15);
}

export function hashCart(input: {
	items: DdCartLine[];
	totalCents: number;
	tipCents: number;
	fulfillment: string;
}): string {
	const normalized = {
		items: [...input.items]
			.sort((a, b) => a.lineId.localeCompare(b.lineId))
			.map((line) => ({
				itemId: line.itemId,
				quantity: line.quantity,
				options: [...line.options].map((option) => option.id).sort(),
			})),
		totalCents: input.totalCents,
		tipCents: input.tipCents,
		fulfillment: input.fulfillment,
	};
	return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

export function totalWithTip(
	quote: DdQuoteSnapshot,
	tipCents: number,
): number | null {
	return quote.totalBeforeTipCents == null
		? null
		: quote.totalBeforeTipCents + tipCents;
}

function hashCode(code: string, approvalId: number): string {
	return createHash("sha256").update(`${code}:${approvalId}`).digest("hex");
}

export type ApprovalDenied = { denied: string };

export async function checkCaps(
	totalCents: number,
	conversationId: string,
): Promise<ApprovalDenied | null> {
	if (totalCents > maxOrderCents()) {
		return {
			denied: `the order cap is $${(maxOrderCents() / 100).toFixed(0)} and this cart totals $${(totalCents / 100).toFixed(2)}`,
		};
	}
	const db = getDb();
	const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
	const [orders] = await db
		.select({ n: count() })
		.from(ddOrders)
		.where(gt(ddOrders.createdAt, dayAgo));
	if ((orders?.n ?? 0) >= maxOrdersPerDay()) {
		return { denied: `the daily cap of ${maxOrdersPerDay()} orders is spent` };
	}
	const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
	const [recent] = await db
		.select({ n: count() })
		.from(ddApprovals)
		.where(
			and(
				eq(ddApprovals.conversationId, conversationId),
				gt(ddApprovals.createdAt, hourAgo),
			),
		);
	if ((recent?.n ?? 0) >= APPROVALS_PER_CONVERSATION_HOUR) {
		return {
			denied: "too many approval requests from this conversation; wait a while",
		};
	}
	const [today] = await db
		.select({ n: count() })
		.from(ddApprovals)
		.where(gt(ddApprovals.createdAt, dayAgo));
	if ((today?.n ?? 0) >= maxApprovalsPerDay()) {
		return { denied: "the approval inbox is closed for today" };
	}
	return null;
}

// One live approval per cart: a new request voids what came before, so
// a stale emailed code can never approve a newer cart.
export async function createApproval(input: {
	conversationId: string;
	cartUuid: string;
	cartHash: string;
	totalCents: number;
	tipCents: number;
}): Promise<{ id: number; code: string; expiresAt: Date }> {
	const db = getDb();
	await db
		.update(ddApprovals)
		.set({ voidedAt: new Date() })
		.where(
			and(
				eq(ddApprovals.cartUuid, input.cartUuid),
				isNull(ddApprovals.consumedAt),
				isNull(ddApprovals.voidedAt),
			),
		);
	const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
	const expiresAt = new Date(Date.now() + CODE_TTL_MS);
	const [row] = await db
		.insert(ddApprovals)
		.values({
			conversationId: input.conversationId,
			cartUuid: input.cartUuid,
			cartHash: input.cartHash,
			totalCents: input.totalCents,
			tipCents: input.tipCents,
			codeHash: "pending",
			expiresAt,
		})
		.returning({ id: ddApprovals.id });
	await db
		.update(ddApprovals)
		.set({ codeHash: hashCode(code, row.id) })
		.where(eq(ddApprovals.id, row.id));
	return { id: row.id, code, expiresAt };
}

export type VerifyResult =
	| { ok: true }
	| {
			ok: false;
			reason: "expired" | "locked" | "wrong" | "gone";
			attemptsLeft?: number;
	  };

export async function verifyApproval(
	approvalId: number,
	code: string,
): Promise<VerifyResult> {
	const db = getDb();
	return db.transaction(async (tx) => {
		const rows = await tx
			.select()
			.from(ddApprovals)
			.where(eq(ddApprovals.id, approvalId))
			.for("update");
		const row = rows[0];
		if (!row || row.voidedAt || row.consumedAt)
			return { ok: false, reason: "gone" };
		if (row.expiresAt.getTime() < Date.now()) {
			return { ok: false, reason: "expired" };
		}
		if (row.attempts >= MAX_ATTEMPTS) return { ok: false, reason: "locked" };
		const expected = Buffer.from(row.codeHash, "hex");
		const provided = Buffer.from(hashCode(code.trim(), approvalId), "hex");
		const match =
			expected.length === provided.length &&
			timingSafeEqual(expected, provided);
		if (!match) {
			const attempts = row.attempts + 1;
			await tx
				.update(ddApprovals)
				.set({
					attempts,
					...(attempts >= MAX_ATTEMPTS ? { voidedAt: new Date() } : {}),
				})
				.where(eq(ddApprovals.id, approvalId));
			return {
				ok: false,
				reason: attempts >= MAX_ATTEMPTS ? "locked" : "wrong",
				attemptsLeft: Math.max(0, MAX_ATTEMPTS - attempts),
			};
		}
		await tx
			.update(ddApprovals)
			.set({ verifiedAt: new Date() })
			.where(eq(ddApprovals.id, approvalId));
		return { ok: true };
	});
}

export type ConsumeResult =
	| { consumed: DdApprovalRow }
	| { alreadyConsumed: DdApprovalRow }
	| { refused: string };

// Single-use under lock. A re-fired turn calling submit again lands on
// alreadyConsumed and reads the recorded outcome instead of paying twice.
export async function consumeApproval(
	approvalId: number,
): Promise<ConsumeResult> {
	const db = getDb();
	return db.transaction(async (tx) => {
		const rows = await tx
			.select()
			.from(ddApprovals)
			.where(eq(ddApprovals.id, approvalId))
			.for("update");
		const row = rows[0];
		if (!row) return { refused: "no such approval" };
		if (row.consumedAt) return { alreadyConsumed: row };
		if (row.voidedAt) return { refused: "the approval was voided" };
		if (!row.verifiedAt) return { refused: "the code was never entered" };
		if (row.expiresAt.getTime() < Date.now()) {
			return { refused: "the approval expired" };
		}
		await tx
			.update(ddApprovals)
			.set({ consumedAt: sql`now()` })
			.where(eq(ddApprovals.id, approvalId));
		const [fresh] = await tx
			.select()
			.from(ddApprovals)
			.where(eq(ddApprovals.id, approvalId));
		return { consumed: fresh };
	});
}

// True when a row actually voided; a consumed approval never rewinds,
// and callers that reopen carts must know the difference.
export async function voidApproval(approvalId: number): Promise<boolean> {
	const rows = await getDb()
		.update(ddApprovals)
		.set({ voidedAt: new Date() })
		.where(and(eq(ddApprovals.id, approvalId), isNull(ddApprovals.consumedAt)))
		.returning({ id: ddApprovals.id });
	return rows.length > 0;
}

export type OrderSlot = { orderId: number } | { denied: string };

// The daily budget must hold even when several verified approvals race
// to submit: the count and the insert serialize under one advisory
// lock, so overlapping submits cannot double-spend the last slot.
export async function reserveOrderSlot(input: {
	approvalId: number;
	conversationId: string;
	cartUuid: string;
	storeName: string;
	totalCents: number;
}): Promise<OrderSlot> {
	const db = getDb();
	return db.transaction(async (tx) => {
		await tx.execute(
			sql`select pg_advisory_xact_lock(hashtext('dd_orders_daily'))`,
		);
		const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
		const [orders] = await tx
			.select({ n: count() })
			.from(ddOrders)
			.where(gt(ddOrders.createdAt, dayAgo));
		if ((orders?.n ?? 0) >= maxOrdersPerDay()) {
			return {
				denied: `the daily cap of ${maxOrdersPerDay()} orders is spent`,
			};
		}
		const [row] = await tx
			.insert(ddOrders)
			.values({
				approvalId: input.approvalId,
				conversationId: input.conversationId,
				cartUuid: input.cartUuid,
				storeName: input.storeName,
				totalCents: input.totalCents,
				status: "pending",
			})
			.returning({ id: ddOrders.id });
		return { orderId: row.id };
	});
}
