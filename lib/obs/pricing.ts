import type { LanguageModelUsage } from "ai";

export type RateCard = {
	input: number;
	output: number;
	cacheRead: number;
	cacheWrite5m: number;
	cacheWrite1h: number;
};

export type Schedule = { validFrom: string; card: RateCard };

// USD per MTok from platform.claude.com/docs/en/about-claude/pricing
// (fetched 2026-07-19). Dated schedules because list prices move:
// Sonnet 5's introductory pricing ends 2026-08-31.
export const PRICE_SCHEDULES: Record<string, Schedule[]> = {
	// ai.google.dev/gemini-api/docs/pricing (fetched 2026-07-21): $0.50/MTok
	// input, $60/MTok image output. No prompt caching on this path.
	"gemini-3.1-flash-image": [
		{
			validFrom: "1970-01-01",
			card: {
				input: 0.5,
				output: 60,
				cacheRead: 0,
				cacheWrite5m: 0,
				cacheWrite1h: 0,
			},
		},
	],
	"claude-fable-5": [
		{
			validFrom: "1970-01-01",
			card: {
				input: 10,
				output: 50,
				cacheRead: 1,
				cacheWrite5m: 12.5,
				cacheWrite1h: 20,
			},
		},
	],
	"claude-mythos-5": [
		{
			validFrom: "1970-01-01",
			card: {
				input: 10,
				output: 50,
				cacheRead: 1,
				cacheWrite5m: 12.5,
				cacheWrite1h: 20,
			},
		},
	],
	"claude-opus-4-8": [
		{
			validFrom: "1970-01-01",
			card: {
				input: 5,
				output: 25,
				cacheRead: 0.5,
				cacheWrite5m: 6.25,
				cacheWrite1h: 10,
			},
		},
	],
	"claude-sonnet-5": [
		{
			validFrom: "1970-01-01",
			card: {
				input: 2,
				output: 10,
				cacheRead: 0.2,
				cacheWrite5m: 2.5,
				cacheWrite1h: 4,
			},
		},
		{
			validFrom: "2026-09-01",
			card: {
				input: 3,
				output: 15,
				cacheRead: 0.3,
				cacheWrite5m: 3.75,
				cacheWrite1h: 6,
			},
		},
	],
	"claude-haiku-4-5": [
		{
			validFrom: "1970-01-01",
			card: {
				input: 1,
				output: 5,
				cacheRead: 0.1,
				cacheWrite5m: 1.25,
				cacheWrite1h: 2,
			},
		},
	],
};

const PER_TOKEN = 1 / 1_000_000;

// known:false means "cannot price", never "free". Aggregate cache
// writes price at the 5m rate: the SDK usage carries no 5m/1h split
// and Rendi only writes 5m caches today.
export function priceUsage(
	model: string | undefined,
	usage: LanguageModelUsage | undefined,
	at: Date = new Date(),
): { usd: number; known: boolean } {
	if (!model || !usage) return { usd: 0, known: false };
	const schedules = PRICE_SCHEDULES[model];
	if (!schedules) return { usd: 0, known: false };
	const stamp = at.toISOString().slice(0, 10);
	const card = schedules.reduce<RateCard | undefined>(
		(current, schedule) =>
			schedule.validFrom <= stamp ? schedule.card : current,
		undefined,
	);
	if (!card) return { usd: 0, known: false };
	const cacheRead = usage.inputTokenDetails?.cacheReadTokens ?? 0;
	const cacheWrite = usage.inputTokenDetails?.cacheWriteTokens ?? 0;
	const uncached =
		usage.inputTokenDetails?.noCacheTokens ??
		Math.max(0, (usage.inputTokens ?? 0) - cacheRead - cacheWrite);
	const usd =
		PER_TOKEN *
		(uncached * card.input +
			cacheRead * card.cacheRead +
			cacheWrite * card.cacheWrite5m +
			(usage.outputTokens ?? 0) * card.output);
	return { usd, known: true };
}
