import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DdCartRow } from "../db/schema.ts";
import * as dd from "./doordash.ts";
import * as db from "./doordash-db.ts";
import {
	opDeleteCart,
	opPreview,
	opSetQuantity,
	opSetTip,
} from "./doordash-ops.ts";

vi.mock("./doordash.ts", () => ({
	cartShow: vi.fn(),
	cartAddItems: vi.fn(),
	cartRemoveItem: vi.fn(),
	cartDelete: vi.fn(),
	orderPreview: vi.fn(),
}));

vi.mock("./doordash-db.ts", () => ({
	getCartSnapshot: vi.fn(),
	upsertCartSnapshot: vi.fn(),
	setCartStatus: vi.fn(),
	setCartTip: vi.fn(),
}));

function snapshot(status: DdCartRow["status"]): DdCartRow {
	return {
		cartUuid: "cart-1",
		conversationId: "conv-1",
		storeId: "store-1",
		storeName: "Toomie's Thai",
		storeImageUrl: null,
		items: [],
		quote: null,
		fulfillment: "delivery",
		scheduledTime: null,
		tipCents: 440,
		status,
		createdAt: new Date(),
		updatedAt: new Date(),
	};
}

const bareLine = (menuId: string | null) => ({
	cart: {
		items: [
			{
				id: "line-1",
				item_id: "item-1",
				menu_id: menuId,
				name: "Taco",
				quantity: 3,
				price: 4.78,
				nested_options: [],
			},
		],
	},
});

beforeEach(() => {
	vi.mocked(db.getCartSnapshot).mockReset();
	vi.mocked(db.upsertCartSnapshot).mockReset();
	vi.mocked(dd.cartShow).mockReset();
	vi.mocked(dd.cartRemoveItem).mockReset();
	vi.mocked(dd.cartAddItems).mockReset();
	vi.mocked(dd.cartDelete).mockReset();
	vi.mocked(dd.orderPreview).mockReset();
});

describe("the seal", () => {
	it("refuses every mutation while the order is being placed", async () => {
		vi.mocked(db.getCartSnapshot).mockResolvedValue(snapshot("placing"));
		await expect(
			opSetTip({ cartUuid: "cart-1", tipCents: 880 }),
		).rejects.toThrow("sealed");
		await expect(
			opDeleteCart({ goal: "g", cartUuid: "cart-1" }),
		).rejects.toThrow("sealed");
		await expect(
			opSetQuantity({
				conversationId: "conv-1",
				goal: "g",
				cartUuid: "cart-1",
				lineId: "line-1",
				quantity: 2,
			}),
		).rejects.toThrow("sealed");
		expect(dd.cartDelete).not.toHaveBeenCalled();
		expect(dd.cartShow).not.toHaveBeenCalled();
	});

	it("a read-only refresh never unseals a placing cart", async () => {
		vi.mocked(db.getCartSnapshot).mockResolvedValue(snapshot("placing"));
		vi.mocked(dd.cartShow).mockResolvedValue(
			bareLine("menu-1") as unknown as Awaited<ReturnType<typeof dd.cartShow>>,
		);
		vi.mocked(dd.orderPreview).mockResolvedValue({} as never);
		await opPreview({
			conversationId: "conv-1",
			goal: "g",
			cartUuid: "cart-1",
		});
		expect(db.upsertCartSnapshot).toHaveBeenCalledWith(
			expect.objectContaining({ status: "placing" }),
		);
	});
});

describe("opSetQuantity shrink", () => {
	it("demands a menu id before removing, so the line cannot vanish", async () => {
		vi.mocked(db.getCartSnapshot).mockResolvedValue(snapshot("open"));
		vi.mocked(dd.cartShow).mockResolvedValue(
			bareLine(null) as unknown as Awaited<ReturnType<typeof dd.cartShow>>,
		);
		await expect(
			opSetQuantity({
				conversationId: "conv-1",
				goal: "g",
				cartUuid: "cart-1",
				lineId: "line-1",
				quantity: 2,
			}),
		).rejects.toThrow("menu id");
		expect(dd.cartRemoveItem).not.toHaveBeenCalled();
	});

	it("shrinking to zero is a plain remove and needs no menu id", async () => {
		vi.mocked(db.getCartSnapshot).mockResolvedValue(snapshot("open"));
		vi.mocked(dd.cartShow)
			.mockResolvedValueOnce(
				bareLine(null) as unknown as Awaited<ReturnType<typeof dd.cartShow>>,
			)
			.mockResolvedValue({ cart: { items: [] } } as unknown as Awaited<
				ReturnType<typeof dd.cartShow>
			>);
		vi.mocked(dd.cartRemoveItem).mockResolvedValue({} as never);
		await opSetQuantity({
			conversationId: "conv-1",
			goal: "g",
			cartUuid: "cart-1",
			lineId: "line-1",
			quantity: 0,
		});
		expect(dd.cartRemoveItem).toHaveBeenCalledOnce();
		expect(dd.cartAddItems).not.toHaveBeenCalled();
	});
});
