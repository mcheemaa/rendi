import type { z } from "zod";
import * as dd from "./doordash.ts";
import {
	type DdCartLine,
	type DdQuoteSnapshot,
	normalizeCartLines,
	normalizeQuote,
} from "./doordash-cart.ts";
import {
	getCartSnapshot,
	setCartStatus,
	setCartTip,
	upsertCartSnapshot,
} from "./doordash-db.ts";
import type { ddCartEnvelope } from "./doordash-schemas.ts";

// One implementation of every cart operation, shared by the agent's tool
// and the UI's exec task, so both hands move the cart through identical
// physics: mutate at DoorDash, re-preview for honest money (law 10),
// upsert the snapshot the cards paint from.

export type CartOpResult = {
	cartUuid: string;
	storeId: string;
	storeName: string;
	items: DdCartLine[];
	quote: DdQuoteSnapshot | null;
	tipCents: number;
	fulfillment: string;
	message?: string | null;
	itemErrors?: z.infer<typeof ddCartEnvelope>["item_errors"];
};

function lineToNewItem(line: DdCartLine, quantity: number): dd.DdNewCartItem {
	return {
		item_id: line.itemId,
		item_name: line.name,
		quantity,
		// Same modifiers, so the backend merges into the existing line
		// instead of forking a second one.
		...(line.options.length
			? {
					nested_options: line.options.map((option) => ({
						id: option.id,
						name: option.name,
						quantity: 1,
					})),
				}
			: {}),
	};
}

async function refreshedSnapshot(input: {
	cartUuid: string;
	conversationId: string;
	goal: string;
	storeId: string;
	storeName: string;
	storeImageUrl?: string | null;
	envelope?: z.infer<typeof ddCartEnvelope>;
	tipCents?: number;
	fulfillment?: string;
}): Promise<CartOpResult> {
	const shown =
		input.envelope?.cart && input.envelope.cart.items.length > 0
			? input.envelope
			: await dd.cartShow(input.cartUuid, input.goal);
	const items = normalizeCartLines(shown.cart ?? null);
	const preview =
		items.length > 0
			? await dd.orderPreview(
					{
						cartUuid: input.cartUuid,
						...(input.fulfillment
							? { fulfillment: input.fulfillment as "delivery" | "pickup" }
							: {}),
					},
					input.goal,
				)
			: null;
	const quote = preview ? normalizeQuote(preview) : null;
	const existing = await getCartSnapshot(input.cartUuid);
	const subtotal = quote?.ladder.find(
		(line) => line.chargeId === "SUBTOTAL",
	)?.cents;
	// The owner tips 10 percent by default; a fresh cart is born with it
	// so the total is never quietly tipless.
	const tipCents =
		input.tipCents ??
		existing?.tipCents ??
		(subtotal ? Math.round(subtotal * 0.1) : 0);
	const fulfillment = input.fulfillment ?? existing?.fulfillment ?? "delivery";
	await upsertCartSnapshot({
		cartUuid: input.cartUuid,
		conversationId: input.conversationId,
		storeId: input.storeId,
		storeName: input.storeName,
		storeImageUrl: input.storeImageUrl,
		items,
		quote,
		tipCents,
		fulfillment,
		status: "open",
	});
	return {
		cartUuid: input.cartUuid,
		storeId: input.storeId,
		storeName: input.storeName,
		items,
		quote,
		tipCents,
		fulfillment,
		message: input.envelope?.message,
		itemErrors: input.envelope?.item_errors,
	};
}

export async function opAddItems(input: {
	conversationId: string;
	goal: string;
	storeId: string;
	storeName: string;
	storeImageUrl?: string | null;
	menuId: string;
	items: dd.DdNewCartItem[];
	cartUuid?: string;
	fulfillment?: "delivery" | "pickup";
}): Promise<CartOpResult | { needsChoices: true; itemErrors: unknown }> {
	const envelope = await dd.cartAddItems(
		{
			storeId: input.storeId,
			menuId: input.menuId,
			items: input.items,
			cartUuid: input.cartUuid,
			fulfillment: input.fulfillment,
		},
		input.goal,
	);
	if (envelope.success === false && envelope.item_errors.length > 0) {
		return { needsChoices: true, itemErrors: envelope.item_errors };
	}
	const cartUuid = envelope.cart_uuid ?? input.cartUuid;
	if (!cartUuid) throw new Error("cart add-items returned no cart");
	return refreshedSnapshot({
		cartUuid,
		conversationId: input.conversationId,
		goal: input.goal,
		storeId: input.storeId,
		storeName: envelope.cart?.store_name ?? input.storeName,
		storeImageUrl: input.storeImageUrl,
		envelope,
	});
}

export async function opSetQuantity(input: {
	conversationId: string;
	goal: string;
	cartUuid: string;
	lineId: string;
	quantity: number;
}): Promise<CartOpResult> {
	const snapshot = await getCartSnapshot(input.cartUuid);
	if (!snapshot) throw new Error("unknown cart");
	const shown = await dd.cartShow(input.cartUuid, input.goal);
	const lines = normalizeCartLines(shown.cart ?? null);
	const line = lines.find((candidate) => candidate.lineId === input.lineId);
	if (!line) throw new Error("that line is no longer in the cart");
	const target = Math.max(0, Math.round(input.quantity));
	const delta = target - line.quantity;
	if (target === 0 || delta < 0) {
		// The backend has no target-quantity; shrinking means remove, then
		// re-add at the target with the same modifiers.
		await dd.cartRemoveItem(
			{ cartUuid: input.cartUuid, cartItemId: line.lineId },
			input.goal,
		);
		if (target > 0 && line.menuId) {
			await dd.cartAddItems(
				{
					storeId: snapshot.storeId,
					menuId: line.menuId,
					items: [lineToNewItem(line, target)],
					cartUuid: input.cartUuid,
				},
				input.goal,
			);
		}
	} else if (delta > 0) {
		if (!line.menuId) throw new Error("line carries no menu id to add against");
		await dd.cartAddItems(
			{
				storeId: snapshot.storeId,
				menuId: line.menuId,
				items: [lineToNewItem(line, delta)],
				cartUuid: input.cartUuid,
			},
			input.goal,
		);
	}
	return refreshedSnapshot({
		cartUuid: input.cartUuid,
		conversationId: input.conversationId,
		goal: input.goal,
		storeId: snapshot.storeId,
		storeName: snapshot.storeName,
		storeImageUrl: snapshot.storeImageUrl,
	});
}

export async function opRemoveLine(input: {
	conversationId: string;
	goal: string;
	cartUuid: string;
	lineId: string;
}): Promise<CartOpResult> {
	const snapshot = await getCartSnapshot(input.cartUuid);
	if (!snapshot) throw new Error("unknown cart");
	const envelope = await dd.cartRemoveItem(
		{ cartUuid: input.cartUuid, cartItemId: input.lineId },
		input.goal,
	);
	return refreshedSnapshot({
		cartUuid: input.cartUuid,
		conversationId: input.conversationId,
		goal: input.goal,
		storeId: snapshot.storeId,
		storeName: snapshot.storeName,
		storeImageUrl: snapshot.storeImageUrl,
		envelope,
	});
}

export async function opPreview(input: {
	conversationId: string;
	goal: string;
	cartUuid: string;
	fulfillment?: "delivery" | "pickup";
}): Promise<CartOpResult> {
	const snapshot = await getCartSnapshot(input.cartUuid);
	if (!snapshot) throw new Error("unknown cart");
	return refreshedSnapshot({
		cartUuid: input.cartUuid,
		conversationId: input.conversationId,
		goal: input.goal,
		storeId: snapshot.storeId,
		storeName: snapshot.storeName,
		storeImageUrl: snapshot.storeImageUrl,
		fulfillment: input.fulfillment,
	});
}

export async function opSetTip(input: {
	cartUuid: string;
	tipCents: number;
}): Promise<{ cartUuid: string; tipCents: number }> {
	// Tip is a submit-time argument at DoorDash; until then it is ours.
	const tipCents = Math.max(0, Math.round(input.tipCents));
	await setCartTip(input.cartUuid, tipCents);
	return { cartUuid: input.cartUuid, tipCents };
}

export async function opDeleteCart(input: {
	goal: string;
	cartUuid: string;
}): Promise<{ deleted: true }> {
	await dd.cartDelete(input.cartUuid, input.goal);
	await setCartStatus(input.cartUuid, "abandoned");
	return { deleted: true };
}
