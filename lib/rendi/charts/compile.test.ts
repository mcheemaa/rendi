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
	name: string;
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
		expect(series.areaStyle).toEqual({ color: tokens.ramp[0], opacity: 0.14 });
	});
});

const longResult: InstrumentResult = {
	columns: [
		{ name: "hour", type: "UInt8" },
		{ name: "weekday", type: "String" },
		{ name: "p50", type: "Float64" },
	],
	rows: [
		{ hour: "0", weekday: "Mon", p50: "42" },
		{ hour: "0", weekday: "Sat", p50: "31" },
		{ hour: "1", weekday: "Mon", p50: "44" },
		{ hour: "1", weekday: "Sat", p50: "30" },
		{ hour: "2", weekday: "Mon", p50: "47" },
	],
	stats: { elapsedMs: 9, serverElapsedMs: 3, rowsRead: 100, bytesRead: 900 },
};

describe("multi-series", () => {
	const lines: ChartPresent = {
		kind: "chart",
		type: "line",
		xField: "hour",
		yField: "p50",
		seriesField: "weekday",
	};

	it("pivots long rows into entity-slotted series with a legend", () => {
		const option = compile(lines, longResult, tokens) as {
			series: Series[];
			legend?: unknown;
		};
		expect(option.series.map((s) => s.name)).toEqual(["Mon", "Sat"]);
		expect(option.series[0].lineStyle?.color).toBe(tokens.ramp[0]);
		expect(option.series[1].lineStyle?.color).toBe(tokens.ramp[1]);
		expect(option.legend).toMatchObject({ icon: "roundRect" });
	});

	it("leaves gaps where a series has no row for a category", () => {
		const option = compile(lines, longResult, tokens) as { series: Series[] };
		expect(option.series[1].data).toEqual([31, 30, null]);
	});

	it("reads wide results as one series per measure column", () => {
		const wide: ChartPresent = {
			kind: "chart",
			type: "line",
			xField: "day",
			yField: ["commits", "reverts"],
		};
		const wideResult: InstrumentResult = {
			...result,
			rows: [
				{ day: "2026-07-01", commits: "12", reverts: "2" },
				{ day: "2026-07-02", commits: "42", reverts: "1" },
			],
		};
		const option = compile(wide, wideResult, tokens) as { series: Series[] };
		expect(option.series.map((s) => s.name)).toEqual(["commits", "reverts"]);
		expect(option.series[1].data).toEqual([2, 1]);
	});

	it("never invents an eighth hue", () => {
		const crowded: InstrumentResult = {
			...longResult,
			rows: Array.from({ length: 9 }, (_, index) => ({
				hour: "0",
				weekday: `series-${index}`,
				p50: "1",
			})),
		};
		const option = compile(lines, crowded, tokens) as { series: Series[] };
		expect(option.series).toHaveLength(7);
	});
});

describe("pie", () => {
	const pie: ChartPresent = {
		kind: "chart",
		type: "pie",
		nameField: "label",
		valueField: "prs",
	};
	const pieResult: InstrumentResult = {
		columns: [
			{ name: "label", type: "String" },
			{ name: "prs", type: "UInt64" },
		],
		rows: [
			{ label: "bug", prs: "428" },
			{ label: "feature", prs: "316" },
			{ label: "docs", prs: "194" },
		],
		stats: { elapsedMs: 8, serverElapsedMs: 2, rowsRead: 40, bytesRead: 400 },
	};

	it("carries the spike's donut craft", () => {
		const option = compile(pie, pieResult, tokens) as {
			color: string[];
			series: {
				radius: string[];
				padAngle: number;
				minAngle: number;
				itemStyle: { borderColor: string; borderWidth: number };
				labelLayout: { hideOverlap: boolean };
			}[];
		};
		expect(option.color).toEqual(tokens.ramp);
		expect(option.series[0].radius).toEqual(["54%", "76%"]);
		expect(option.series[0].padAngle).toBe(1.5);
		expect(option.series[0].minAngle).toBe(6);
		expect(option.series[0].itemStyle).toMatchObject({
			borderColor: tokens.surface,
			borderWidth: 2,
		});
		expect(option.series[0].labelLayout).toEqual({ hideOverlap: true });
	});

	it("folds the tail past the ramp into a muted Other", () => {
		const crowded: InstrumentResult = {
			...pieResult,
			rows: Array.from({ length: 9 }, (_, index) => ({
				label: `label-${index}`,
				prs: String(100 - index),
			})),
		};
		const option = compile(pie, crowded, tokens) as {
			series: { data: { name: string; value: number }[] }[];
		};
		const data = option.series[0].data;
		expect(data).toHaveLength(7);
		expect(data.at(-1)).toMatchObject({ name: "Other", value: 94 + 93 + 92 });
	});
});

describe("scatter", () => {
	it("plots value pairs on two value axes with visible markers", () => {
		const scatter: ChartPresent = {
			kind: "chart",
			type: "scatter",
			xField: "distance",
			yField: "fare",
		};
		const scatterResult: InstrumentResult = {
			columns: [
				{ name: "distance", type: "Float64" },
				{ name: "fare", type: "Float64" },
			],
			rows: [
				{ distance: "1.2", fare: "8.5" },
				{ distance: "3.4", fare: "14.0" },
			],
			stats: { elapsedMs: 7, serverElapsedMs: 2, rowsRead: 20, bytesRead: 200 },
		};
		const option = compile(scatter, scatterResult, tokens) as {
			xAxis: { type: string };
			series: { symbolSize: number; data: [number, number][] }[];
		};
		expect(option.xAxis.type).toBe("value");
		expect(option.series[0].symbolSize).toBeGreaterThanOrEqual(8);
		expect(option.series[0].data).toEqual([
			[1.2, 8.5],
			[3.4, 14],
		]);
	});
});

describe("heatmap", () => {
	it("grids two category axes with the amber magnitude scale", () => {
		const heatmap: ChartPresent = {
			kind: "chart",
			type: "heatmap",
			xField: "hour",
			yField: "weekday",
			valueField: "commits",
		};
		const heatResult: InstrumentResult = {
			columns: [],
			rows: [
				{ hour: "0", weekday: "Mon", commits: "3" },
				{ hour: "1", weekday: "Mon", commits: "9" },
				{ hour: "0", weekday: "Tue", commits: "5" },
			],
			stats: { elapsedMs: 5, serverElapsedMs: 1, rowsRead: 30, bytesRead: 300 },
		};
		const option = compile(heatmap, heatResult, tokens) as {
			xAxis: { data: string[] };
			yAxis: { data: string[] };
			visualMap: { text: string[]; inRange: { color: string[] } };
			series: {
				data: number[][];
				itemStyle: { borderColor: string; borderWidth: number };
			}[];
		};
		expect(option.xAxis.data).toEqual(["0", "1"]);
		expect(option.yAxis.data).toEqual(["Mon", "Tue"]);
		expect(option.visualMap.text).toEqual(["More", "Less"]);
		expect(option.visualMap.inRange.color).toHaveLength(5);
		expect(option.visualMap.inRange.color[4]).toBe("rgba(185, 122, 24, 1)");
		expect(option.series[0].data).toContainEqual([1, 0, 9]);
		expect(option.series[0].itemStyle).toMatchObject({
			borderColor: tokens.surface,
			borderWidth: 2,
		});
	});
});

describe("calendar", () => {
	it("draws the GitHub graph from a date column", () => {
		const calendar: ChartPresent = {
			kind: "chart",
			type: "calendar",
			dateField: "day",
			valueField: "commits",
		};
		const calendarResult: InstrumentResult = {
			columns: [],
			rows: [
				{ day: "2026-06-21", commits: "3" },
				{ day: "2026-07-19", commits: "12" },
			],
			stats: { elapsedMs: 5, serverElapsedMs: 1, rowsRead: 30, bytesRead: 300 },
		};
		const option = compile(calendar, calendarResult, tokens) as {
			calendar: {
				range: string[];
				cellSize: (string | number)[];
				dayLabel: { nameMap: string[] };
			};
			series: { coordinateSystem: string; data: [string, number][] }[];
			visualMap: { text: string[] };
		};
		expect(option.calendar.range).toEqual(["2026-06-21", "2026-07-19"]);
		expect(option.calendar.cellSize).toEqual(["auto", 13]);
		expect(option.calendar.dayLabel.nameMap).toEqual([
			"",
			"Mon",
			"",
			"Wed",
			"",
			"Fri",
			"",
		]);
		expect(option.series[0].coordinateSystem).toBe("calendar");
		expect(option.series[0].data).toContainEqual(["2026-07-19", 12]);
		expect(option.visualMap.text).toEqual(["More", "Less"]);
	});
});

describe("radar", () => {
	it("profiles rows as axes with a shared honest max", () => {
		const radar: ChartPresent = {
			kind: "chart",
			type: "radar",
			nameField: "activity",
			valueField: "share",
		};
		const radarResult: InstrumentResult = {
			columns: [],
			rows: [
				{ activity: "Commits", share: "79" },
				{ activity: "Pull requests", share: "15" },
				{ activity: "Code review", share: "4" },
				{ activity: "Issues", share: "2" },
			],
			stats: { elapsedMs: 4, serverElapsedMs: 1, rowsRead: 4, bytesRead: 64 },
		};
		const option = compile(radar, radarResult, tokens) as {
			radar: { indicator: { name: string; max: number }[] };
			series: {
				lineStyle: { width: number };
				areaStyle: { opacity: number };
				data: { value: number[] }[];
			}[];
		};
		expect(option.radar.indicator).toHaveLength(4);
		// 79 rounds up to the nice ceiling so the rings land on clean steps.
		expect(option.radar.indicator.every((i) => i.max === 100)).toBe(true);
		expect(option.series[0].lineStyle.width).toBe(2);
		expect(option.series[0].areaStyle.opacity).toBe(0.14);
		expect(option.series[0].data[0].value).toEqual([79, 15, 4, 2]);
	});
});
