import { eq } from "drizzle-orm";
import type { drizzle } from "drizzle-orm/pglite";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ddApprovals, ddOrders } from "../db/schema.ts";
import {
	checkCaps,
	consumeApproval,
	createApproval,
	hashCart,
	totalWithTip,
	verifyApproval,
	voidApproval,
} from "./doordash-approval.ts";
import type { DdCartLine, DdQuoteSnapshot } from "./doordash-cart.ts";
import { createTestDb } from "./harness/test-db.ts";

const holder = vi.hoisted(() => ({ db: undefined as unknown }));

vi.mock("../db/index.ts", () => ({
	getDb: () => holder.db,
}));

type Db = ReturnType<typeof drizzle>;

beforeEach(async () => {
	holder.db = await createTestDb();
});

function db(): Db {
	return holder.db as Db;
}

const line = (
	lineId: string,
	itemId: string,
	quantity: number,
	optionIds: string[] = [],
): DdCartLine => ({
	lineId,
	itemId,
	name: itemId,
	quantity,
	priceCents: 1000,
	options: optionIds.map((id) => ({ id, name: id })),
});

async function mintApproval(
	overrides: Partial<Parameters<typeof createApproval>[0]> = {},
) {
	return createApproval({
		conversationId: "conv-1",
		cartUuid: "cart-1",
		cartHash: "h".repeat(64),
		totalCents: 3317,
		tipCents: 440,
		...overrides,
	});
}

async function row(id: number) {
	const [found] = await db()
		.select()
		.from(ddApprovals)
		.where(eq(ddApprovals.id, id));
	return found;
}

describe("hashCart", () => {
	it("is insensitive to line and option order", () => {
		const a = hashCart({
			items: [line("b", "pad-see-ew", 2, ["x", "y"]), line("a", "tofu", 1)],
			totalCents: 3317,
			tipCents: 440,
			fulfillment: "delivery",
		});
		const b = hashCart({
			items: [line("a", "tofu", 1), line("b", "pad-see-ew", 2, ["y", "x"])],
			totalCents: 3317,
			tipCents: 440,
			fulfillment: "delivery",
		});
		expect(a).toBe(b);
	});

	it("moves when anything the owner approved moves", () => {
		const base = {
			items: [line("a", "tofu", 1)],
			totalCents: 3317,
			tipCents: 440,
			fulfillment: "delivery",
		};
		const hash = hashCart(base);
		expect(hashCart({ ...base, tipCents: 880 })).not.toBe(hash);
		expect(hashCart({ ...base, totalCents: 3318 })).not.toBe(hash);
		expect(hashCart({ ...base, fulfillment: "pickup" })).not.toBe(hash);
		expect(hashCart({ ...base, items: [line("a", "tofu", 2)] })).not.toBe(hash);
	});
});

describe("totalWithTip", () => {
	it("adds tip only when the quote actually priced", () => {
		const quote = { totalBeforeTipCents: 2877 } as DdQuoteSnapshot;
		expect(totalWithTip(quote, 440)).toBe(3317);
		expect(
			totalWithTip({ totalBeforeTipCents: null } as DdQuoteSnapshot, 440),
		).toBeNull();
	});
});

describe("the approval lifecycle", () => {
	it("verifies the emailed code exactly once per approval", async () => {
		const approval = await mintApproval();
		expect(approval.code).toMatch(/^\d{6}$/);
		expect(await verifyApproval(approval.id, approval.code)).toEqual({
			ok: true,
		});
		expect((await row(approval.id)).verifiedAt).not.toBeNull();
	});

	it("binds the code to its approval, not just to its digits", async () => {
		const first = await mintApproval({ cartUuid: "cart-1" });
		const second = await mintApproval({ cartUuid: "cart-2" });
		// On the one-in-a-million digit collision, flip a digit so the
		// assertion stays deterministic.
		const foreign =
			first.code === second.code
				? (first.code[0] === "9" ? "0" : "9") + first.code.slice(1)
				: first.code;
		expect(await verifyApproval(second.id, foreign)).toMatchObject({
			ok: false,
		});
	});

	it("a new approval on the same cart voids the old one", async () => {
		const stale = await mintApproval();
		const fresh = await mintApproval();
		expect(await verifyApproval(stale.id, stale.code)).toEqual({
			ok: false,
			reason: "gone",
		});
		expect(await verifyApproval(fresh.id, fresh.code)).toEqual({ ok: true });
	});

	it("locks and voids after five wrong guesses", async () => {
		const approval = await mintApproval();
		const wrong = approval.code === "000000" ? "111111" : "000000";
		for (let guess = 1; guess <= 4; guess++) {
			expect(await verifyApproval(approval.id, wrong)).toEqual({
				ok: false,
				reason: "wrong",
				attemptsLeft: 5 - guess,
			});
		}
		expect(await verifyApproval(approval.id, wrong)).toEqual({
			ok: false,
			reason: "locked",
			attemptsLeft: 0,
		});
		expect((await row(approval.id)).voidedAt).not.toBeNull();
		expect(await verifyApproval(approval.id, approval.code)).toEqual({
			ok: false,
			reason: "gone",
		});
	});

	it("refuses expired codes even when correct", async () => {
		const approval = await mintApproval();
		await db()
			.update(ddApprovals)
			.set({ expiresAt: new Date(Date.now() - 1000) })
			.where(eq(ddApprovals.id, approval.id));
		expect(await verifyApproval(approval.id, approval.code)).toEqual({
			ok: false,
			reason: "expired",
		});
	});

	it("consumes only verified approvals, and only once", async () => {
		const approval = await mintApproval();
		expect(await consumeApproval(approval.id)).toEqual({
			refused: "the code was never entered",
		});
		await verifyApproval(approval.id, approval.code);
		const first = await consumeApproval(approval.id);
		expect("consumed" in first && first.consumed.id).toBe(approval.id);
		const second = await consumeApproval(approval.id);
		expect("alreadyConsumed" in second && second.alreadyConsumed.id).toBe(
			approval.id,
		);
	});

	it("refuses to consume a verified approval that expired waiting", async () => {
		const approval = await mintApproval();
		await verifyApproval(approval.id, approval.code);
		await db()
			.update(ddApprovals)
			.set({ expiresAt: new Date(Date.now() - 1000) })
			.where(eq(ddApprovals.id, approval.id));
		expect(await consumeApproval(approval.id)).toEqual({
			refused: "the approval expired",
		});
	});

	it("void never rewinds a consumed approval", async () => {
		const approval = await mintApproval();
		await verifyApproval(approval.id, approval.code);
		await consumeApproval(approval.id);
		await voidApproval(approval.id);
		expect((await row(approval.id)).voidedAt).toBeNull();
	});
});

describe("checkCaps", () => {
	it("refuses a cart above the order cap", async () => {
		const denied = await checkCaps(10_001, "conv-1");
		expect(denied?.denied).toContain("order cap");
		expect(await checkCaps(10_000, "conv-1")).toBeNull();
	});

	it("closes after the daily order budget is spent", async () => {
		for (let n = 0; n < 3; n++) {
			const approval = await mintApproval({ cartUuid: `cart-${n}` });
			await db()
				.insert(ddOrders)
				.values({
					approvalId: approval.id,
					conversationId: "conv-1",
					cartUuid: `cart-${n}`,
					storeName: "Toomie's Thai",
					totalCents: 3317,
					status: "successful",
				});
		}
		const denied = await checkCaps(3317, "conv-9");
		expect(denied?.denied).toContain("daily cap");
	});

	it("rate-limits approval requests per conversation", async () => {
		await mintApproval();
		await mintApproval();
		await mintApproval();
		const denied = await checkCaps(3317, "conv-1");
		expect(denied?.denied).toContain("too many approval requests");
		expect(await checkCaps(3317, "conv-2")).toBeNull();
	});

	it("closes the approval inbox for the day", async () => {
		for (let n = 0; n < 15; n++) {
			await mintApproval({
				conversationId: `conv-${n}`,
				cartUuid: `cart-${n}`,
			});
		}
		const denied = await checkCaps(3317, "conv-fresh");
		expect(denied?.denied).toContain("closed for today");
	});

	it("the daily budget widens by env for a challenge window", async () => {
		const original = process.env.DD_MAX_APPROVALS_PER_DAY;
		process.env.DD_MAX_APPROVALS_PER_DAY = "2";
		try {
			await mintApproval({ conversationId: "conv-a", cartUuid: "cart-a" });
			await mintApproval({ conversationId: "conv-b", cartUuid: "cart-b" });
			const denied = await checkCaps(3317, "conv-c");
			expect(denied?.denied).toContain("closed for today");
			process.env.DD_MAX_APPROVALS_PER_DAY = "40";
			expect(await checkCaps(3317, "conv-c")).toBeNull();
		} finally {
			if (original === undefined) delete process.env.DD_MAX_APPROVALS_PER_DAY;
			else process.env.DD_MAX_APPROVALS_PER_DAY = original;
		}
	});
});
