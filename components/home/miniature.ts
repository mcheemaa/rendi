import type { EChartsCoreOption } from "echarts/core";
import { alpha } from "@/lib/rendi/charts/compile";
import type { EmberTokens } from "@/lib/rendi/charts/tokens";

// Fixed illustrative data for the home vignette. These are decorative
// miniatures, not instruments; they never touch the exec pipeline.

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 8);

function heatCells(): Array<[number, number, number]> {
	const cells: Array<[number, number, number]> = [];
	for (let day = 0; day < WEEKDAYS.length; day++) {
		for (let hour = 0; hour < HOURS.length; hour++) {
			const midweek = 1 - Math.abs(day - 2) * 0.22;
			const afternoon = Math.exp(-((hour - 6) ** 2) / 14);
			cells.push([
				hour,
				day,
				Math.round(20 * midweek * afternoon + ((hour * 7 + day * 3) % 4)),
			]);
		}
	}
	return cells;
}

function categoryAxisLabel(tokens: EmberTokens) {
	return {
		color: tokens.muted,
		fontFamily: tokens.fontMono,
		fontSize: 7.5,
	};
}

export function answerHeatmap(
	tokens: EmberTokens,
	animate: boolean,
): EChartsCoreOption {
	return {
		animationDuration: animate ? 450 : 0,
		animationEasing: "cubicOut",
		grid: { left: 6, right: 8, top: 4, bottom: 2, containLabel: true },
		xAxis: {
			type: "category",
			data: HOURS,
			axisLine: { show: false },
			axisTick: { show: false },
			axisLabel: { ...categoryAxisLabel(tokens), interval: 3 },
		},
		yAxis: {
			type: "category",
			data: WEEKDAYS,
			axisLine: { show: false },
			axisTick: { show: false },
			axisLabel: categoryAxisLabel(tokens),
		},
		visualMap: {
			show: false,
			min: 0,
			max: 23,
			inRange: {
				color: [
					alpha(tokens.accent, 0.1),
					alpha(tokens.accent, 0.34),
					alpha(tokens.accent, 0.62),
					tokens.accent,
				],
			},
		},
		series: [
			{
				type: "heatmap",
				data: heatCells(),
				animationDelay: (i: number) => (animate ? i * 8 : 0),
				itemStyle: {
					borderColor: tokens.surface,
					borderWidth: 1.5,
					borderRadius: 1.5,
				},
			},
		],
	};
}

export function weekdayBars(
	tokens: EmberTokens,
	animate: boolean,
): EChartsCoreOption {
	return {
		animationDuration: animate ? 550 : 0,
		animationEasing: "cubicOut",
		grid: { left: 6, right: 8, top: 6, bottom: 2, containLabel: true },
		xAxis: {
			type: "category",
			data: ["M", "T", "W", "T", "F", "S", "S"],
			axisLine: { show: false },
			axisTick: { show: false },
			axisLabel: categoryAxisLabel(tokens),
		},
		yAxis: { type: "value", show: false },
		series: [
			{
				type: "bar",
				data: [12, 14, 21, 15, 13, 4, 3],
				barWidth: "62%",
				itemStyle: { color: tokens.ramp[1], borderRadius: [2.5, 2.5, 0, 0] },
				animationDelay: (i: number) => (animate ? i * 55 : 0),
			},
		],
	};
}

// The seed shifts the crests so each redraw breathes a slightly different
// shape without ever reaching for randomness.
export function ambientWave(
	tokens: EmberTokens,
	seed: number,
	animate: boolean,
): EChartsCoreOption {
	const first = 22 + ((seed * 9) % 17);
	const second = 58 + ((seed * 5) % 11);
	const values = Array.from(
		{ length: 80 },
		(_, i) =>
			12 +
			34 * Math.exp(-((i - first - Math.sin(i * 0.7) * 5) ** 2) / 260) +
			22 * Math.exp(-((i - second) ** 2) / 110) +
			((i * 13) % 7),
	);
	return {
		animationDuration: animate ? 6000 : 0,
		animationEasing: "cubicInOut",
		grid: { left: -30, right: -30, top: "14%", bottom: -2 },
		xAxis: {
			type: "category",
			show: false,
			boundaryGap: false,
			data: values.map((_, i) => i),
		},
		yAxis: { type: "value", show: false },
		series: [
			{
				type: "line",
				smooth: 0.42,
				showSymbol: false,
				data: values,
				lineStyle: { color: tokens.accent, width: 1.5, opacity: 0.24 },
				areaStyle: { color: tokens.accent, opacity: 0.055 },
			},
		],
	};
}
