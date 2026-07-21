import { describe, expect, it } from "vitest";
import type { InstrumentResult } from "../exec.ts";
import { type ChartPresent, compile } from "./compile.ts";
import type { EmberTokens } from "./tokens.ts";

const tokens: EmberTokens = {
	surface: "#ffffff",
	ink: "#1e2226",
	muted: "#6e6a61",
	line: "#e6e1d6",
	accent: "#b97a18",
	glow: "rgba(185, 122, 24, 0.14)",
	ramp: [
		"#b97a18",
		"#068c7c",
		"#7a5ea8",
		"#c14f4f",
		"#3e6fa8",
		"#4e8a3c",
		"#a64d7e",
	],
	fontSans: "Instrument Sans",
	fontMono: "Geist Mono",
};

// UInt64 arrives quoted, the way ClickHouse's JSON format actually sends it.
const result: InstrumentResult = {
	columns: [
		{ name: "day", type: "Date" },
		{ name: "commits", type: "UInt64" },
	],
	rows: [
		{ day: "2026-07-01", commits: "12" },
		{ day: "2026-07-02", commits: "42" },
		{ day: "2026-07-03", commits: null },
	],
	stats: { elapsedMs: 41, serverElapsedMs: 5, rowsRead: 7641, bytesRead: 91 },
};

const bar: ChartPresent = {
	kind: "chart",
	type: "bar",
	xField: "day",
	yField: "commits",
};

type Series = {
	type: string;
	data: (number | null)[];
	itemStyle: { color: string; borderRadius?: number[] };
	lineStyle?: { color: string; width: number };
	areaStyle?: { color: string; opacity: number };
	barWidth?: string;
	smooth?: number;
	animationDelay?: (index: number) => number;
};

function seriesOf(option: ReturnType<typeof compile>): Series {
	return (option.series as Series[])[0];
}

describe("compile, the craft laws", () => {
	it("dresses a bar in amber with the spike's mark treatment", () => {
		const option = compile(bar, result, tokens) as Record<string, never>;
		const series = seriesOf(option);

		expect(series.type).toBe("bar");
		expect(series.itemStyle.color).toBe(tokens.ramp[0]);
		expect(series.itemStyle.borderRadius).toEqual([3, 3, 0, 0]);
		expect(series.barWidth).toBe("62%");
		expect(option.grid).toMatchObject({ containLabel: true });
		expect(option.tooltip).toMatchObject({
			backgroundColor: tokens.surface,
			axisPointer: { shadowStyle: { color: tokens.glow } },
		});
	});

	it("numbers quoted 64-bit integers and turns junk into gaps", () => {
		const series = seriesOf(compile(bar, result, tokens));
		expect(series.data).toEqual([12, 42, null]);
	});

	it("keeps one y-axis by construction", () => {
		const option = compile(bar, result, tokens) as { yAxis: unknown };
		expect(Array.isArray(option.yAxis)).toBe(false);
	});

	it("dresses text in ink and muted, never a series hue", () => {
		const option = compile(bar, result, tokens) as {
			xAxis: { axisLabel: { color: string; fontFamily: string } };
			tooltip: { textStyle: { color: string } };
		};
		expect(option.xAxis.axisLabel.color).toBe(tokens.muted);
		expect(option.xAxis.axisLabel.fontFamily).toBe(tokens.fontMono);
		expect(option.tooltip.textStyle.color).toBe(tokens.ink);
	});

	it("ships no legend for a single series", () => {
		const option = compile(bar, result, tokens) as { legend?: unknown };
		expect(option.legend).toBeUndefined();
	});

	it("staggers the entrance and stills it under reduced motion", () => {
		const animated = compile(bar, result, tokens) as {
			animationDuration: number;
		};
		expect(animated.animationDuration).toBe(650);
		expect(seriesOf(animated).animationDelay?.(3)).toBe(66);

		const still = compile(bar, result, tokens, { reducedMotion: true }) as {
			animationDuration: number;
		};
		expect(still.animationDuration).toBe(0);
		expect(seriesOf(still).animationDelay?.(3)).toBe(0);
	});

	it("enables aria and flips the decal texture on request", () => {
		const plain = compile(bar, result, tokens) as {
			aria: { enabled: boolean; decal: { show: boolean } };
		};
		expect(plain.aria.enabled).toBe(true);
		expect(plain.aria.decal.show).toBe(false);

		const textured = compile(bar, result, tokens, { decal: true }) as {
			aria: { decal: { show: boolean } };
		};
		expect(textured.aria.decal.show).toBe(true);
	});

	it("draws a line thin, smooth, and flush to the axis", () => {
		const line: ChartPresent = { ...bar, type: "line" };
		const option = compile(line, result, tokens) as {
			xAxis: { boundaryGap: boolean };
		};
		const series = seriesOf(option);

		expect(series.smooth).toBe(0.28);
		expect(series.lineStyle).toEqual({ color: tokens.ramp[0], width: 2 });
		expect(series.areaStyle).toBeUndefined();
		expect(option.xAxis.boundaryGap).toBe(false);
	});

	it("washes an area in the accent at low opacity", () => {
		const area: ChartPresent = { ...bar, type: "area" };
		const series = seriesOf(compile(area, result, tokens));

		expect(series.type).toBe("line");
		expect(series.areaStyle).toEqual({ color: tokens.accent, opacity: 0.14 });
	});
});
