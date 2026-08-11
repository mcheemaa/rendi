import { tool } from "ai";
import { z } from "zod";
import * as dd from "@/lib/rendi/doordash";

// Read-only DoorDash. Money never moves from here: carting and ordering
// are their own tools with their own gates, arriving in later slices.
export const doordashBrowse = tool({
	description:
		"Browse the owner's DoorDash account, read-only. Verbs: search (restaurants; near the saved default address unless lat/lng name another place), nearby-stores (groceries, convenience, pets, retail, alcohol via vertical; nv means every non-restaurant kind), menu (a restaurant's items; storeId), store-details (address and metadata; storeId), item-details (pricing and the full modifier tree; storeId + itemId, plus menuId for restaurants), find-items (search inside a grocery or retail store; storeId + queries), order-history (max, days), order-receipt (orderUuid), addresses, payment-methods. Search and item-details render as cards the user sees, so fetch details for the few items you actually recommend. Distances arrive in meters. Popularity data is unavailable by policy; if asked, say so.",
	inputSchema: z.object({
		verb: z.enum([
			"search",
			"nearby-stores",
			"menu",
			"store-details",
			"item-details",
			"find-items",
			"order-history",
			"order-receipt",
			"addresses",
			"payment-methods",
		]),
		goal: z
			.string()
			.describe(
				"The user's ask behind this browse, verbatim; DoorDash requires it as the intent audit trail",
			),
		query: z.string().optional().describe("search: what to look for"),
		storeId: z.string().optional(),
		menuId: z
			.string()
			.optional()
			.describe("item-details at restaurants; comes from the menu response"),
		itemId: z.string().optional(),
		queries: z
			.array(z.string())
			.optional()
			.describe("find-items: several item names resolve in one call"),
		vertical: z
			.enum(["grocery", "alcohol", "convenience", "pets", "retail", "nv"])
			.optional(),
		limit: z.number().int().min(1).max(20).optional(),
		lat: z.number().optional(),
		lng: z.number().optional(),
		max: z.number().int().min(1).max(100).optional(),
		days: z.number().int().min(1).max(365).optional(),
		orderUuid: z.string().optional(),
	}),
	execute: async (input) => {
		const { verb, goal } = input;
		// Challenge posture: with guests holding gate codes, the owner's
		// addresses, cards, and history stay theirs. Money already cannot
		// move without the owner's inbox; this keeps their privacy whole.
		const personal = new Set([
			"addresses",
			"payment-methods",
			"order-history",
			"order-receipt",
		]);
		if (process.env.DD_HIDE_PERSONAL === "1" && personal.has(verb)) {
			return { private: true, note: "the owner keeps that private" };
		}
		const need = (value: string | undefined, name: string): string => {
			if (!value) throw new Error(`${verb} needs ${name}`);
			return value;
		};
		switch (verb) {
			case "search": {
				const found = await dd.search(
					{
						query: need(input.query, "query"),
						lat: input.lat,
						lng: input.lng,
						limit: input.limit,
					},
					goal,
				);
				if (process.env.DD_HIDE_PERSONAL === "1") {
					// The model must not echo the owner's street to guests.
					found.delivery_address = null;
				}
				return found;
			}
			case "nearby-stores":
				return dd.findNearbyStores(
					{
						vertical: input.vertical,
						max: input.max,
						lat: input.lat,
						lng: input.lng,
					},
					goal,
				);
			case "menu":
				return dd.menu(need(input.storeId, "storeId"), goal);
			case "store-details":
				return dd.storeDetails(need(input.storeId, "storeId"), goal);
			case "item-details":
				return input.menuId
					? dd.restaurantItemDetails(
							{
								storeId: need(input.storeId, "storeId"),
								menuId: input.menuId,
								itemId: need(input.itemId, "itemId"),
							},
							goal,
						)
					: dd.itemDetails(
							{
								storeId: need(input.storeId, "storeId"),
								itemId: need(input.itemId, "itemId"),
							},
							goal,
						);
			case "find-items":
				return dd.findItems(
					{
						storeId: need(input.storeId, "storeId"),
						queries: input.queries ?? [],
					},
					goal,
				);
			case "order-history":
				return dd.orderHistory({ max: input.max, days: input.days }, goal);
			case "order-receipt":
				return dd.orderReceipt(need(input.orderUuid, "orderUuid"), goal);
			case "addresses":
				return dd.addressList(goal);
			case "payment-methods":
				return dd.paymentMethodList(goal);
		}
	},
});
