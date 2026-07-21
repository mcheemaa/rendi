import type { EChartsCoreOption } from "echarts/core";
import type { InstrumentResult } from "../exec.ts";
import type { Present } from "../instrument.ts";
import type { EmberTokens } from "./tokens.ts";

export type ChartPresent = Extract<Present, { kind: "chart" }>;

export type CompileOptions = {
	decal?: boolean;
	reducedMotion?: boolean;
};

const ENTRANCE_MS = 650;
const STAGGER_MS = 22;

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

// The compiler owns the craft: the agent picks data and form, every law
// (single series wears amber, text wears ink, one y-axis, motion respects
// the reader) is enforced here, unreachable from the spec.
export function compile(
	present: ChartPresent,
	result: InstrumentResult,
	tokens: EmberTokens,
	options: CompileOptions = {},
): EChartsCoreOption {
	const animate = !options.reducedMotion;
	const categories = result.rows.map((row) => String(row[present.xField]));
	// ClickHouse's JSON format quotes 64-bit integers; nulls and junk become
	// gaps rather than zeros, which would be lies.
	const values = result.rows.map((row) => {
		const raw = row[present.yField];
		if (raw === null || raw === undefined || raw === "") return null;
		const numeric = Number(raw);
		return Number.isFinite(numeric) ? numeric : null;
	});

	const base = {
		aria: { enabled: true, decal: { show: options.decal ?? false } },
		animationDuration: animate ? ENTRANCE_MS : 0,
		animationEasing: "cubicOut" as const,
		grid: { left: 8, right: 16, top: 18, bottom: 6, containLabel: true },
		xAxis: {
			type: "category",
			data: categories,
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

	if (present.type === "bar") {
		return {
			...base,
			tooltip: {
				trigger: "axis",
				axisPointer: { type: "shadow", shadowStyle: { color: tokens.glow } },
				...tooltipStyle(tokens),
			},
			series: [
				{
					type: "bar",
					name: present.yField,
					data: values,
					// Slot 1, amber: a single series always wears the sequential
					// hue. Multi-series slots come from a stable entity map when
					// the spec grows them, never from rank.
					itemStyle: { color: tokens.ramp[0], borderRadius: [3, 3, 0, 0] },
					barWidth: "62%",
					animationDelay: (index: number) => (animate ? index * STAGGER_MS : 0),
					emphasis: { itemStyle: { color: tokens.accent } },
				},
			],
		};
	}

	return {
		...base,
		tooltip: {
			trigger: "axis",
			axisPointer: { type: "line", lineStyle: { color: tokens.line } },
			...tooltipStyle(tokens),
		},
		xAxis: { ...base.xAxis, boundaryGap: false },
		series: [
			{
				type: "line",
				name: present.yField,
				data: values,
				smooth: 0.28,
				showSymbol: false,
				symbolSize: 6,
				lineStyle: { color: tokens.ramp[0], width: 2 },
				itemStyle: { color: tokens.ramp[0] },
				emphasis: { focus: "series" },
				...(present.type === "area"
					? { areaStyle: { color: tokens.accent, opacity: 0.14 } }
					: {}),
			},
		],
	};
}
