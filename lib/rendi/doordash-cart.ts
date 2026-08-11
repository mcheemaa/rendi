import type { z } from "zod";
import type { ddCartEnvelope, ddPreviewResult } from "./doordash-schemas.ts";

// The cart's truth lives at DoorDash; these are the render snapshots we
// keep in Neon so cards paint instantly and history renders forever.
// Money is integer cents everywhere; dollars exist only at render.

export type DdCartLine = {
	lineId: string;
	itemId: string;
	menuId?: string | null;
	name: string;
	quantity: number;
	priceCents: number | null;
	imageUrl?: string | null;
	// Ids ride along so a quantity change can re-add the line with the
	// exact same modifiers, which is what keeps the backend merging.
	options: { id: string; name: string }[];
};

export type DdQuoteSnapshot = {
	ladder: {
		chargeId: string;
		label: string;
		cents: number;
		displayString: string;
		negative: boolean;
		originalCents?: number;
	}[];
	totalBeforeTipCents: number | null;
	currency: string;
	asapAvailable: boolean;
	etaRange?: string | null;
	deliveryOptions: { type: string; title: string; etaRange?: string | null }[];
};

export type DdCartStatus =
	| "open"
	| "awaiting_code"
	| "placing"
	| "placed"
	| "failed"
	| "voided"
	| "abandoned";

function dollarsToCents(dollars: number | null | undefined): number | null {
	return dollars == null ? null : Math.round(dollars * 100);
}

export function normalizeCartLines(
	cart: z.infer<typeof ddCartEnvelope>["cart"],
): DdCartLine[] {
	if (!cart) return [];
	return cart.items.map((line) => ({
		lineId: line.id,
		itemId: line.item_id,
		menuId: line.menu_id ?? null,
		name: line.name,
		quantity: line.quantity,
		priceCents: dollarsToCents(line.price),
		imageUrl: line.image_url ?? null,
		options: line.nested_options.flatMap((option) => {
			const name = option.item_extra_option?.name;
			const optionId = option.item_extra_option?.id ?? option.id;
			return name && optionId ? [{ id: optionId, name }] : [];
		}),
	}));
}

export function normalizeQuote(
	preview: z.infer<typeof ddPreviewResult>,
): DdQuoteSnapshot | null {
	const quote = preview.quote;
	if (!quote) return null;
	const availability = quote.delivery_availability;
	return {
		ladder: quote.line_items.map((line) => ({
			chargeId: line.charge_id,
			label: line.label,
			cents: line.final_money.unit_amount,
			displayString: line.final_money.display_string,
			// Their sign flag is true for charges; discounts arrive false.
			negative: line.final_money.sign === false,
			...(line.original_money &&
			line.original_money.unit_amount !== line.final_money.unit_amount
				? { originalCents: line.original_money.unit_amount }
				: {}),
		})),
		totalBeforeTipCents: quote.total_before_tip?.unit_amount ?? null,
		currency: quote.currency ?? "USD",
		asapAvailable: availability?.asap_available ?? false,
		etaRange: availability?.asap_minutes_range_string ?? null,
		deliveryOptions: (availability?.delivery_options ?? []).map((option) => ({
			type: option.delivery_option_type,
			title: option.option_title,
			etaRange: option.eta_minutes_range ?? null,
		})),
	};
}
