import { tool } from "ai";
import { z } from "zod";
import * as dd from "@/lib/rendi/doordash";
import {
	opAddItems,
	opDeleteCart,
	opPreview,
	opRemoveLine,
	opSetQuantity,
	opSetTip,
} from "@/lib/rendi/doordash-ops";
import { turnContext } from "@/lib/rendi/harness/telemetry";

const newItem = z.object({
	item_id: z.string(),
	item_name: z.string(),
	quantity: z.number().int().min(1),
	nested_options: z
		.array(
			z.object({
				id: z.string(),
				name: z.string(),
				quantity: z.number().int().min(1).default(1),
			}),
		)
		.optional()
		.describe(
			"Selected option ids from item-details extras[].options[]; required when the item has required modifiers",
		),
});

// Cart mutations short of money. Submission has its own tools and its
// own gate; nothing here can charge anything.
export const doordashCart = tool({
	description:
		"Build and edit DoorDash carts. Verbs: add-items (storeId, menuId, items; APPENDS and sums quantities on repeat item_id; without cartUuid a preflight reports any existing open cart at that store so the user chooses extend or replace, pass extend: true to add to it), set-quantity (cartUuid, lineId, quantity; the honest target-quantity), remove-line (cartUuid, lineId), set-tip (cartUuid, tipCents; the owner's default is 10 percent of subtotal), set-fulfillment (cartUuid, fulfillment; re-prices), preview (cartUuid; fresh honest pricing, run it before talking money), delete-cart (cartUuid). Mutations re-preview automatically and return the priced cart; each renders live in the chat as the order card.",
	inputSchema: z.object({
		verb: z.enum([
			"add-items",
			"set-quantity",
			"remove-line",
			"set-tip",
			"set-fulfillment",
			"preview",
			"delete-cart",
		]),
		goal: z
			.string()
			.describe("The user's ask behind this, verbatim; DoorDash requires it"),
		storeId: z.string().optional(),
		storeName: z.string().optional(),
		storeImageUrl: z.string().optional(),
		menuId: z.string().optional(),
		items: z.array(newItem).optional(),
		cartUuid: z.string().optional(),
		lineId: z.string().optional(),
		quantity: z.number().int().min(0).optional(),
		tipCents: z.number().int().min(0).optional(),
		fulfillment: z.enum(["delivery", "pickup"]).optional(),
		extend: z
			.boolean()
			.optional()
			.describe(
				"add-items only: true means add to the existing open cart the preflight reported",
			),
	}),
	execute: async (input) => {
		const conversationId = turnContext()?.conversationId ?? "";
		const { verb, goal } = input;
		const need = <T>(value: T | undefined, name: string): T => {
			if (value === undefined) throw new Error(`${verb} needs ${name}`);
			return value;
		};
		switch (verb) {
			case "add-items": {
				const storeId = need(input.storeId, "storeId");
				// One open cart per store is DoorDash law; adding blind would
				// silently extend a cart the user may have forgotten.
				if (!input.cartUuid && !input.extend) {
					const open = await dd.cartList(goal, storeId);
					const existing = open.carts.find((cart) => cart.store_id === storeId);
					if (existing) {
						return {
							existingCart: {
								cartUuid: existing.cart_uuid,
								storeName: existing.store_name,
								itemsCount: existing.items_count,
							},
							hint: "An open cart already exists at this store. Ask the user: extend it (re-call with extend true and this cartUuid) or replace it (delete-cart first).",
						};
					}
				}
				return opAddItems({
					conversationId,
					goal,
					storeId,
					storeName: input.storeName ?? "",
					storeImageUrl: input.storeImageUrl,
					menuId: need(input.menuId, "menuId"),
					items: need(input.items, "items"),
					cartUuid: input.cartUuid,
					fulfillment: input.fulfillment,
				});
			}
			case "set-quantity":
				return opSetQuantity({
					conversationId,
					goal,
					cartUuid: need(input.cartUuid, "cartUuid"),
					lineId: need(input.lineId, "lineId"),
					quantity: need(input.quantity, "quantity"),
				});
			case "remove-line":
				return opRemoveLine({
					conversationId,
					goal,
					cartUuid: need(input.cartUuid, "cartUuid"),
					lineId: need(input.lineId, "lineId"),
				});
			case "set-tip":
				return opSetTip({
					cartUuid: need(input.cartUuid, "cartUuid"),
					tipCents: need(input.tipCents, "tipCents"),
				});
			case "set-fulfillment":
			case "preview":
				return opPreview({
					conversationId,
					goal,
					cartUuid: need(input.cartUuid, "cartUuid"),
					fulfillment:
						verb === "set-fulfillment"
							? need(input.fulfillment, "fulfillment")
							: input.fulfillment,
				});
			case "delete-cart":
				return opDeleteCart({
					goal,
					cartUuid: need(input.cartUuid, "cartUuid"),
				});
		}
	},
});
