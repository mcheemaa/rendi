import { promisify } from "node:util";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	addressListFixture,
	itemDetailsFixture,
	menuFixture,
	orderHistoryFixture,
	paymentMethodsFixture,
	searchFixture,
} from "./doordash.fixtures.ts";
import { intentFor, runDd, search } from "./doordash.ts";
import {
	ddAddressList,
	ddItemDetails,
	ddMenuResult,
	ddOrderHistory,
	ddPaymentMethods,
	ddSearchResult,
} from "./doordash-schemas.ts";

const impl = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", async () => {
	const { promisify: custom } = await import("node:util");
	const execFile = Object.assign(vi.fn(), { [custom.custom]: impl });
	return { execFile };
});

beforeEach(() => {
	impl.mockClear();
});

function envelope(structuredContent: unknown) {
	return {
		stdout: JSON.stringify({
			content: [{ type: "text", text: "ok" }],
			structuredContent,
			isError: false,
		}),
		stderr: "",
	};
}

describe("schemas against captured envelopes", () => {
	it("parses search and strips widget noise", () => {
		const result = ddSearchResult.parse(searchFixture);
		expect(result.stores).toHaveLength(2);
		expect(result.stores[0].store_id).toBe("55382");
		expect(result.stores[1].review_count).toBe(1800);
		expect("widget_type" in result).toBe(false);
	});

	it("parses the menu and never surfaces popularity", () => {
		const result = ddMenuResult.parse(menuFixture);
		expect(result.menu_id).toBe("1657275");
		expect(result.items).toHaveLength(2);
		for (const item of result.items) {
			expect("is_popular" in item).toBe(false);
			expect("popularity_rank" in item).toBe(false);
		}
	});

	it("parses item details through nested combo extras", () => {
		const result = ddItemDetails.parse(itemDetailsFixture);
		const combo = result.item.extras[0].options?.[1];
		expect(combo?.extras?.[0].options?.map((option) => option.name)).toEqual([
			"Gyoza",
			"Karaage",
		]);
		expect(result.item.popular_modifications[0].description).toContain(
			"Extra Egg",
		);
	});

	it("parses history, addresses, and cards", () => {
		expect(ddOrderHistory.parse(orderHistoryFixture).orders[0].store_id).toBe(
			"55382",
		);
		const addresses = ddAddressList.parse(addressListFixture);
		expect(addresses.addresses.find((address) => address.is_default)?.lat).toBe(
			37.79,
		);
		expect(ddPaymentMethods.parse(paymentMethodsFixture).cards[0].last4).toBe(
			"4242",
		);
	});
});

describe("intentFor", () => {
	it("writes their two-line contract from the verbatim ask", () => {
		const intent = intentFor("order  me\nramen");
		expect(intent.split("\n")).toHaveLength(2);
		expect(intent).toContain('user prompt/purpose: "order me ramen"');
	});

	it("caps runaway goals", () => {
		expect(intentFor("x".repeat(500)).length).toBeLessThan(300);
	});
});

describe("runDd", () => {
	it("composes json-output plus intent and returns structuredContent", async () => {
		impl.mockResolvedValueOnce(envelope({ ok: 1 }));
		const result = await runDd(["address", "list"], "test goal");
		expect(result).toEqual({ ok: 1 });
		const [, args] = impl.mock.calls[0] as [string, string[]];
		expect(args[0]).toBe("--json-output");
		expect(args.slice(1, 3)).toEqual(["address", "list"]);
		expect(args[3]).toBe("--intent");
		expect(args[4]).toContain("Summary:");
	});

	it("throws the envelope's own error text on isError", async () => {
		impl.mockResolvedValueOnce({
			stdout: JSON.stringify({
				content: [{ type: "text", text: "Store is closed" }],
				isError: true,
			}),
			stderr: "",
		});
		await expect(runDd(["menu"], "g")).rejects.toThrow("Store is closed");
	});

	it("translates missing credentials into the re-mint instruction", async () => {
		impl.mockRejectedValueOnce({
			code: 1,
			stderr: "Error: Failed to execute command due to missing credentials.",
		});
		await expect(runDd(["search"], "g")).rejects.toThrow(/export-token/);
	});

	it("names the timeout honestly", async () => {
		impl.mockRejectedValueOnce({ killed: true });
		await expect(runDd(["menu"], "g")).rejects.toThrow(/timed out/);
	});
});

describe("search location doctrine", () => {
	it("uses explicit coordinates without touching the address book", async () => {
		impl.mockResolvedValueOnce(envelope(searchFixture));
		await search({ query: "ramen", lat: 1.5, lng: -2.5 }, "g");
		expect(impl).toHaveBeenCalledTimes(1);
		const [, args] = impl.mock.calls[0] as [string, string[]];
		expect(args).toContain("--lat");
		expect(args[args.indexOf("--lat") + 1]).toBe("1.5");
	});

	it("resolves the saved default address when coordinates are absent", async () => {
		vi.resetModules();
		impl.mockReset();
		impl.mockResolvedValueOnce(envelope(addressListFixture));
		impl.mockResolvedValueOnce(envelope(searchFixture));
		const fresh = await import("./doordash.ts");
		await fresh.search({ query: "ramen" }, "g");
		expect(impl).toHaveBeenCalledTimes(2);
		const [, searchArgs] = impl.mock.calls[1] as [string, string[]];
		expect(searchArgs[searchArgs.indexOf("--lat") + 1]).toBe("37.79");
	});

	it("translates widget stage directions into the honest fact", async () => {
		impl.mockResolvedValueOnce(
			envelope({
				stores: [],
				needs_address: true,
				message:
					"The widget is showing an address picker. Do NOT output additional text or commentary.",
			}),
		);
		const result = await search({ query: "tacos", lat: 1, lng: 2 }, "g");
		expect(result.message).not.toMatch(/widget/i);
		expect(result.message).toContain("saved addresses");
	});
});

// promisify is imported so the custom-symbol mock stays anchored to the
// same node:util instance the wrapper uses.
void promisify;
