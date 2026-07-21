import type { EChartsCoreOption } from "echarts/core";
import type { InstrumentResult } from "../exec.ts";
import type { Present } from "../instrument.ts";
import type { EmberTokens } from "./tokens.ts";

export type ChartPresent = Extract<Present, { kind: "chart" }>;
type Cartesian = Extract<
	ChartPresent,
	{ type: "bar" | "line" | "area" | "scatter" }
>;
type Rows = InstrumentResult["rows"];

export type CompileOptions = {
	decal?: boolean;
	reducedMotion?: boolean;
};

const ENTRANCE_MS = 650;
const STAGGER_MS = 22;
// The Ember ramp holds seven validated hues; an eighth series is never a
// generated color. Cartesian charts keep the first seven, pies fold the
// tail into Other, and agent.md caps the series dimension at the source.
const RAMP_CAP = 7;

// ClickHouse's JSON format quotes 64-bit integers; nulls and junk become
// gaps rather than zeros, which would be lies.
function numeric(raw: unknown): number | null {
	if (raw === null || raw === undefined || raw === "") return null;
	const value = Number(raw);
	return Number.isFinite(value) ? value : null;
}

function distinct(rows: Rows, field: string): string[] {
	const seen = new Set<string>();
	for (const row of rows) seen.add(String(row[field]));
	return [...seen];
}

function alpha(hex: string, value: number): string {
	const r = Number.parseInt(hex.slice(1, 3), 16);
	const g = Number.parseInt(hex.slice(3, 5), 16);
	const b = Number.parseInt(hex.slice(5, 7), 16);
	return `rgba(${r}, ${g}, ${b}, ${value})`;
}

function axisText(tokens: EmberTokens) {
	return {
		axisLine: { lineStyle: { color: tokens.line } },
		axisTick: { show: false },
		axisLabel: {
			color: tokens.muted,
			fontFamily: tokens.fontMono,
			fontSize: 11,
		},
		nameTextStyle: {
			color: tokens.muted,
			fontFamily: tokens.fontMono,
			fontSize: 10.5,
		},
	};
}

function tooltipStyle(tokens: EmberTokens) {
	return {
		backgroundColor: tokens.surface,
		borderColor: tokens.line,
		borderWidth: 1,
		padding: [8, 12],
		textStyle: {
			color: tokens.ink,
			fontFamily: tokens.fontSans,
			fontSize: 12.5,
		},
		extraCssText:
			"border-radius:10px;box-shadow:0 8px 28px -14px rgba(0,0,0,.35);",
	};
}

function legend(tokens: EmberTokens) {
	return {
		bottom: 0,
		icon: "roundRect",
		itemWidth: 11,
		itemHeight: 3,
		itemGap: 16,
		textStyle: {
			color: tokens.muted,
			fontFamily: tokens.fontSans,
			fontSize: 12,
		},
		inactiveColor: tokens.line,
	};
}

// The GitHub-graph scale: five amber intensities over the surface, framed
// by a quiet Less/More piecewise legend. Sequential magnitude stays one hue.
function magnitudeScale(tokens: EmberTokens, values: number[]) {
	const max = values.length > 0 ? Math.max(...values) : 1;
	return {
		type: "piecewise" as const,
		min: 0,
		max: Math.max(max, 1),
		splitNumber: 5,
		orient: "horizontal" as const,
		right: 8,
		bottom: 0,
		itemWidth: 11,
		itemHeight: 11,
		itemGap: 3,
		text: ["More", "Less"],
		textStyle: {
			color: tokens.muted,
			fontFamily: tokens.fontMono,
			fontSize: 10.5,
		},
		showLabel: false,
		inRange: {
			color: [0.15, 0.32, 0.52, 0.74, 1].map((step) =>
				alpha(tokens.accent, step),
			),
		},
	};
}

// The compiler owns the craft: the agent picks data and form, every law
// (single series wears amber, entity keeps its slot, text wears ink, one
// y-axis, motion respects the reader) is enforced here, unreachable from
// the spec.
export function compile(
	present: ChartPresent,
	result: InstrumentResult,
	tokens: EmberTokens,
	options: CompileOptions = {},
): EChartsCoreOption {
	const animate = !options.reducedMotion;
	const base = {
		aria: { enabled: true, decal: { show: options.decal ?? false } },
		animationDuration: animate ? ENTRANCE_MS : 0,
		animationEasing: "cubicOut" as const,
	};
	switch (present.type) {
		case "pie":
			return pieOption(present, result, tokens, base);
		case "heatmap":
			return heatmapOption(present, result, tokens, base);
		case "calendar":
			return calendarOption(present, result, tokens, base);
		case "radar":
			return radarOption(present, result, tokens, base);
		default:
			return cartesianOption(present, result, tokens, base, animate);
	}
}

type Base = {
	aria: { enabled: boolean; decal: { show: boolean } };
	animationDuration: number;
	animationEasing: "cubicOut";
};

// One entity, one slot, assigned by first appearance and never by rank;
// legend toggles hide series in place, so survivors keep their colors.
function seriesTable(
	present: Cartesian,
	rows: Rows,
): { name: string; data: (number | null)[] | [number, number][] }[] {
	if (present.seriesField && typeof present.yField === "string") {
		const field = present.seriesField;
		const measure = present.yField;
		const names = distinct(rows, field).slice(0, RAMP_CAP);
		if (present.type === "scatter") {
			return names.map((name) => ({
				name,
				data: rows
					.filter((row) => String(row[field]) === name)
					.map(
						(row) =>
							[
								numeric(row[present.xField]) ?? 0,
								numeric(row[measure]) ?? 0,
							] as [number, number],
					),
			}));
		}
		const categories = distinct(rows, present.xField);
		return names.map((name) => {
			const own = new Map(
				rows
					.filter((row) => String(row[field]) === name)
					.map((row) => [String(row[present.xField]), numeric(row[measure])]),
			);
			return { name, data: categories.map((c) => own.get(c) ?? null) };
		});
	}
	const measures = Array.isArray(present.yField)
		? present.yField.slice(0, RAMP_CAP)
		: [present.yField];
	if (present.type === "scatter") {
		return measures.map((measure) => ({
			name: measure,
			data: rows.map(
				(row) =>
					[numeric(row[present.xField]) ?? 0, numeric(row[measure]) ?? 0] as [
						number,
						number,
					],
			),
		}));
	}
	return measures.map((measure) => ({
		name: measure,
		data: rows.map((row) => numeric(row[measure])),
	}));
}

function cartesianOption(
	present: Cartesian,
	result: InstrumentResult,
	tokens: EmberTokens,
	base: Base,
	animate: boolean,
): EChartsCoreOption {
	const table = seriesTable(present, result.rows);
	const multi = table.length > 1;
	const scatter = present.type === "scatter";
	const axes = {
		xAxis: scatter
			? { type: "value", ...axisText(tokens), splitLine: { show: false } }
			: {
					type: "category",
					data: distinct(result.rows, present.xField),
					...axisText(tokens),
					splitLine: { show: false },
					boundaryGap: present.type === "bar",
				},
		// One y-axis by construction: a single object, never an array, so a
		// dual-axis chart is unrepresentable.
		yAxis: {
			type: "value",
			...axisText(tokens),
			axisLine: { show: false },
			splitLine: { lineStyle: { color: tokens.line, type: [3, 4] } },
			scale: present.type !== "bar",
		},
	};
	const frame = {
		...base,
		...axes,
		grid: {
			left: 8,
			right: 16,
			top: 18,
			bottom: multi ? 30 : 6,
			containLabel: true,
		},
		...(multi ? { legend: legend(tokens) } : {}),
		tooltip: {
			trigger: scatter ? ("item" as const) : ("axis" as const),
			...(present.type === "bar"
				? {
						axisPointer: {
							type: "shadow",
							shadowStyle: { color: tokens.glow },
						},
					}
				: scatter
					? {}
					: {
							axisPointer: { type: "line", lineStyle: { color: tokens.line } },
						}),
			...tooltipStyle(tokens),
		},
	};

	if (present.type === "bar") {
		return {
			...frame,
			series: table.map((series, slot) => ({
				type: "bar",
				name: series.name,
				data: series.data,
				itemStyle: {
					color: tokens.ramp[slot],
					borderRadius: [3, 3, 0, 0],
				},
				barWidth: multi ? undefined : "62%",
				animationDelay: (index: number) => (animate ? index * STAGGER_MS : 0),
				...(multi
					? { emphasis: { focus: "series" as const } }
					: { emphasis: { itemStyle: { color: tokens.accent } } }),
			})),
		};
	}
	if (scatter) {
		return {
			...frame,
			series: table.map((series, slot) => ({
				type: "scatter",
				name: series.name,
				data: series.data,
				symbolSize: 9,
				itemStyle: { color: tokens.ramp[slot], opacity: 0.85 },
				emphasis: { focus: "series" as const },
			})),
		};
	}
	return {
		...frame,
		series: table.map((series, slot) => ({
			type: "line",
			name: series.name,
			data: series.data,
			smooth: 0.28,
			showSymbol: false,
			symbolSize: 6,
			lineStyle: { color: tokens.ramp[slot], width: 2 },
			itemStyle: { color: tokens.ramp[slot] },
			emphasis: { focus: "series" as const },
			...(present.type === "area"
				? {
						areaStyle: {
							color: tokens.ramp[slot],
							opacity: multi ? 0.1 : 0.14,
						},
					}
				: {}),
		})),
	};
}

function pieOption(
	present: Extract<ChartPresent, { type: "pie" }>,
	result: InstrumentResult,
	tokens: EmberTokens,
	base: Base,
): EChartsCoreOption {
	const numberFormat = new Intl.NumberFormat("en-US");
	const slices = result.rows.map((row) => ({
		name: String(row[present.nameField]),
		value: numeric(row[present.valueField]) ?? 0,
	}));
	// A pie is additive, so the tail past the ramp folds into a muted Other
	// instead of inventing an eighth hue.
	const kept = slices.slice(0, RAMP_CAP - (slices.length > RAMP_CAP ? 1 : 0));
	const rest = slices.slice(kept.length);
	const data = [
		...kept,
		...(rest.length > 0
			? [
					{
						name: "Other",
						value: rest.reduce((sum, slice) => sum + slice.value, 0),
						itemStyle: { color: tokens.muted },
					},
				]
			: []),
	];
	return {
		...base,
		color: tokens.ramp,
		tooltip: {
			trigger: "item",
			...tooltipStyle(tokens),
			valueFormatter: (value: unknown) => numberFormat.format(Number(value)),
		},
		series: [
			{
				type: "pie",
				name: present.valueField,
				radius: ["54%", "76%"],
				center: ["50%", "46%"],
				avoidLabelOverlap: true,
				minAngle: 6,
				padAngle: 1.5,
				itemStyle: {
					borderColor: tokens.surface,
					borderWidth: 2,
					borderRadius: 3,
				},
				label: {
					alignTo: "edge",
					edgeDistance: 6,
					color: tokens.ink,
					fontFamily: tokens.fontSans,
					fontSize: 12,
					formatter: (params: { name: string; value: number }) =>
						`{name|${params.name}}  {v|${numberFormat.format(params.value)}}`,
					rich: {
						name: {
							color: tokens.ink,
							fontFamily: tokens.fontSans,
							fontSize: 12,
							padding: [0, 0, 2, 0],
						},
						v: {
							color: tokens.muted,
							fontFamily: tokens.fontMono,
							fontSize: 11,
						},
					},
				},
				labelLine: {
					length: 14,
					length2: 14,
					lineStyle: { color: tokens.line },
				},
				labelLayout: { hideOverlap: true },
				data,
			},
		],
	};
}

function heatmapOption(
	present: Extract<ChartPresent, { type: "heatmap" }>,
	result: InstrumentResult,
	tokens: EmberTokens,
	base: Base,
): EChartsCoreOption {
	const xCategories = distinct(result.rows, present.xField);
	const yCategories = distinct(result.rows, present.yField);
	const values: number[] = [];
	const data = result.rows.map((row) => {
		const value = numeric(row[present.valueField]) ?? 0;
		values.push(value);
		return [
			xCategories.indexOf(String(row[present.xField])),
			yCategories.indexOf(String(row[present.yField])),
			value,
		];
	});
	return {
		...base,
		grid: { left: 8, right: 16, top: 12, bottom: 28, containLabel: true },
		tooltip: {
			trigger: "item",
			...tooltipStyle(tokens),
			formatter: (params: { value: [number, number, number] }) =>
				`${xCategories[params.value[0]]} · ${yCategories[params.value[1]]}<br><b>${params.value[2]}</b>`,
		},
		xAxis: {
			type: "category",
			data: xCategories,
			...axisText(tokens),
			splitLine: { show: false },
			axisLine: { show: false },
		},
		yAxis: {
			type: "category",
			data: yCategories,
			...axisText(tokens),
			splitLine: { show: false },
			axisLine: { show: false },
		},
		visualMap: magnitudeScale(tokens, values),
		series: [
			{
				type: "heatmap",
				name: present.valueField,
				data,
				// The 2px surface gap between fills, the same spacer law the
				// donut borders follow; it is what makes the grid read as cells.
				itemStyle: {
					borderColor: tokens.surface,
					borderWidth: 2,
					borderRadius: 2,
				},
				emphasis: { itemStyle: { borderColor: tokens.accent, borderWidth: 1 } },
			},
		],
	};
}

function calendarOption(
	present: Extract<ChartPresent, { type: "calendar" }>,
	result: InstrumentResult,
	tokens: EmberTokens,
	base: Base,
): EChartsCoreOption {
	const values: number[] = [];
	const data = result.rows.map((row) => {
		const value = numeric(row[present.valueField]) ?? 0;
		values.push(value);
		return [String(row[present.dateField]).slice(0, 10), value];
	});
	const days = data.map(([day]) => String(day)).sort();
	const range =
		days.length > 0 ? [days[0], days[days.length - 1]] : ["2026-01-01"];
	return {
		...base,
		tooltip: {
			trigger: "item",
			...tooltipStyle(tokens),
			formatter: (params: { value: [string, number] }) =>
				`${params.value[0]}<br><b>${params.value[1]}</b>`,
		},
		calendar: {
			range,
			cellSize: ["auto", 13],
			top: 30,
			left: 34,
			right: 8,
			splitLine: { show: false },
			// Zero days stay visible as faint cells, the way GitHub keeps the
			// grid whole; days with data paint over them.
			itemStyle: {
				color: alpha(tokens.line, 0.55),
				borderColor: tokens.surface,
				borderWidth: 2,
			},
			dayLabel: {
				// The GitHub cadence: Mon, Wed, Fri only.
				nameMap: ["", "Mon", "", "Wed", "", "Fri", ""],
				color: tokens.muted,
				fontFamily: tokens.fontMono,
				fontSize: 10.5,
			},
			monthLabel: {
				color: tokens.muted,
				fontFamily: tokens.fontMono,
				fontSize: 10.5,
			},
			yearLabel: { show: false },
		},
		visualMap: magnitudeScale(tokens, values),
		series: [
			{
				type: "heatmap",
				coordinateSystem: "calendar",
				name: present.valueField,
				data,
				itemStyle: { borderRadius: 2 },
			},
		],
	};
}

function radarOption(
	present: Extract<ChartPresent, { type: "radar" }>,
	result: InstrumentResult,
	tokens: EmberTokens,
	base: Base,
): EChartsCoreOption {
	const axes = result.rows.map((row) => ({
		name: String(row[present.nameField]),
		value: numeric(row[present.valueField]) ?? 0,
	}));
	// A shared max keeps every axis in one unit, honest and comparable.
	const max = Math.max(1, ...axes.map((axis) => axis.value));
	return {
		...base,
		tooltip: { trigger: "item", ...tooltipStyle(tokens) },
		radar: {
			indicator: axes.map((axis) => ({ name: axis.name, max })),
			radius: "68%",
			center: ["50%", "52%"],
			splitNumber: 4,
			axisName: {
				color: tokens.muted,
				fontFamily: tokens.fontMono,
				fontSize: 11,
			},
			splitLine: { lineStyle: { color: tokens.line } },
			splitArea: { show: false },
			axisLine: { lineStyle: { color: tokens.line } },
		},
		series: [
			{
				type: "radar",
				name: present.valueField,
				symbol: "circle",
				symbolSize: 6,
				lineStyle: { color: tokens.ramp[0], width: 2 },
				itemStyle: { color: tokens.ramp[0] },
				areaStyle: { color: tokens.accent, opacity: 0.14 },
				data: [{ name: present.valueField, value: axes.map((a) => a.value) }],
			},
		],
	};
}
