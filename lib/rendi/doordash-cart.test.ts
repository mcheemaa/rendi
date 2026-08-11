import { describe, expect, it } from "vitest";
import {
	cartAddRequiredOptionsFixture,
	cartShowFixture,
	previewFixture,
} from "./doordash.fixtures.ts";
import { normalizeCartLines, normalizeQuote } from "./doordash-cart.ts";
import { ddCartEnvelope, ddPreviewResult } from "./doordash-schemas.ts";

describe("cart wire shapes", () => {
	it("parses a live cart with option names on the line", () => {
		const envelope = ddCartEnvelope.parse(cartShowFixture);
		const lines = normalizeCartLines(envelope.cart);
		expect(lines).toHaveLength(1);
		expect(lines[0]).toMatchObject({
			lineId: "line-1",
			itemId: "8001",
			quantity: 3,
			priceCents: 1850,
			options: [{ id: "44958508375", name: "Medium" }],
		});
	});

	it("surfaces required-options failures as a render-ready schema", () => {
		const envelope = ddCartEnvelope.parse(cartAddRequiredOptionsFixture);
		expect(envelope.success).toBe(false);
		const need = envelope.item_errors[0].required_options[0];
		expect(need.name).toBe("Ice Level");
		expect(need.options.map((option) => option.name)).toEqual([
			"Regular Ice",
			"Less Ice",
		]);
	});
});

describe("quote normalization", () => {
	it("keeps the ladder in cents with display strings and discount signs", () => {
		const preview = ddPreviewResult.parse(previewFixture);
		const quote = normalizeQuote(preview);
		expect(quote?.ladder.map((line) => line.chargeId)).toEqual([
			"SUBTOTAL",
			"DELIVERY_FEE",
			"TAXES_AND_FEES",
			"PROMOTION_DISCOUNT",
		]);
		expect(quote?.ladder[0]).toMatchObject({ cents: 4398, negative: false });
		expect(quote?.ladder[3]).toMatchObject({ cents: 1999, negative: true });
		// The struck-through original survives only when it differs.
		expect(quote?.ladder[1].originalCents).toBe(99);
		expect(quote?.ladder[0].originalCents).toBeUndefined();
		expect(quote?.totalBeforeTipCents).toBe(2877);
		expect(quote?.etaRange).toBe("26-41 min");
		expect(quote?.deliveryOptions.map((option) => option.type)).toEqual([
			"STANDARD",
			"SCHEDULE",
		]);
	});

	it("renders a closed store honestly", () => {
		const closed = ddPreviewResult.parse({
			...previewFixture,
			quote: {
				...previewFixture.quote,
				delivery_availability: {
					...previewFixture.quote.delivery_availability,
					asap_available: false,
				},
			},
		});
		expect(normalizeQuote(closed)?.asapAvailable).toBe(false);
	});
});
