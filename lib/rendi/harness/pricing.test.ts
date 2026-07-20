import type { LanguageModelUsage } from "ai";
import { describe, expect, it } from "vitest";
import { priceUsage } from "./pricing.ts";

function usage(
	input: number,
	output: number,
	cacheRead = 0,
	cacheWrite = 0,
): LanguageModelUsage {
	return {
		inputTokens: input + cacheRead + cacheWrite,
		outputTokens: output,
		totalTokens: input + cacheRead + cacheWrite + output,
		inputTokenDetails: {
			noCacheTokens: input,
			cacheReadTokens: cacheRead,
			cacheWriteTokens: cacheWrite,
		},
		outputTokenDetails: { textTokens: output, reasoningTokens: 0 },
	} as LanguageModelUsage;
}

describe("priceUsage", () => {
	it("prices opus at documented list rates", () => {
		const { usd, known } = priceUsage("claude-opus-4-8", usage(1000, 100));
		expect(known).toBe(true);
		expect(usd).toBeCloseTo((1000 * 5 + 100 * 25) / 1_000_000, 10);
	});

	it("prices cache reads at the cache rate, not the input rate", () => {
		const { usd } = priceUsage("claude-opus-4-8", usage(2, 70, 1500));
		expect(usd).toBeCloseTo((2 * 5 + 1500 * 0.5 + 70 * 25) / 1_000_000, 10);
	});

	it("prices cache writes at the 5m rate", () => {
		const { usd } = priceUsage("claude-opus-4-8", usage(2, 70, 0, 1500));
		expect(usd).toBeCloseTo((2 * 5 + 1500 * 6.25 + 70 * 25) / 1_000_000, 10);
	});

	it("applies the Sonnet 5 introductory schedule before September 2026", () => {
		const { usd } = priceUsage(
			"claude-sonnet-5",
			usage(1000, 100),
			new Date("2026-08-31T23:00:00Z"),
		);
		expect(usd).toBeCloseTo((1000 * 2 + 100 * 10) / 1_000_000, 10);
	});

	it("applies the Sonnet 5 standard schedule from September 2026", () => {
		const { usd } = priceUsage(
			"claude-sonnet-5",
			usage(1000, 100),
			new Date("2026-09-01T00:00:00Z"),
		);
		expect(usd).toBeCloseTo((1000 * 3 + 100 * 15) / 1_000_000, 10);
	});

	it("prices fable and mythos identically", () => {
		const fable = priceUsage("claude-fable-5", usage(1000, 100));
		const mythos = priceUsage("claude-mythos-5", usage(1000, 100));
		expect(fable.usd).toBe(mythos.usd);
		expect(fable.usd).toBeCloseTo((1000 * 10 + 100 * 50) / 1_000_000, 10);
	});

	it("reports unknown models as unpriceable, never free", () => {
		expect(priceUsage("gpt-oss-9000", usage(1000, 100))).toEqual({
			usd: 0,
			known: false,
		});
		expect(priceUsage(undefined, usage(1000, 100)).known).toBe(false);
		expect(priceUsage("claude-opus-4-8", undefined).known).toBe(false);
	});
});
