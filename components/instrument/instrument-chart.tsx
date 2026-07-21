"use client";

import { useEffect, useRef } from "react";
import { type ChartPresent, compile } from "@/lib/rendi/charts/compile";
import { type ECharts, echarts } from "@/lib/rendi/charts/echarts";
import { useEmberTokens } from "@/lib/rendi/charts/tokens";
import type { InstrumentResult } from "@/lib/rendi/exec";

// SVG for the card-sized results instruments actually show; canvas only
// when a series is dense enough that DOM nodes would drag.
const CANVAS_THRESHOLD = 4000;

export function InstrumentChart({
	present,
	result,
	title,
}: {
	present: ChartPresent;
	result: InstrumentResult;
	title: string;
}) {
	const host = useRef<HTMLDivElement>(null);
	const chart = useRef<ECharts | null>(null);
	// The renderer is chosen once, from the first result; steering repaints
	// the same instance via setOption.
	const renderer = useRef(
		result.rows.length > CANVAS_THRESHOLD
			? ("canvas" as const)
			: ("svg" as const),
	);
	const tokens = useEmberTokens();

	useEffect(() => {
		if (!host.current) return;
		const instance = echarts.init(host.current, null, {
			renderer: renderer.current,
		});
		chart.current = instance;
		const observer = new ResizeObserver(() => instance.resize());
		observer.observe(host.current);
		return () => {
			observer.disconnect();
			instance.dispose();
			chart.current = null;
		};
	}, []);

	useEffect(() => {
		if (!tokens) return;
		const reducedMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		chart.current?.setOption(
			compile(present, result, tokens, { reducedMotion }),
			{ notMerge: true },
		);
	}, [present, result, tokens]);

	// A calendar runs wide and short; everything else gets the full well.
	const height = present.type === "calendar" ? "h-[220px]" : "h-[340px]";

	return (
		<div className="relative">
			<div
				ref={host}
				className={`${height} w-full`}
				role="img"
				aria-label={title}
			/>
			{present.type === "pie" ? (
				<DonutCenter present={present} result={result} />
			) : null}
		</div>
	);
}

const centerFormat = new Intl.NumberFormat("en-US");

// The spike's donut center: the total lives in the hole, in ink, while the
// slices carry identity. Pointer events pass through to the chart.
function DonutCenter({
	present,
	result,
}: {
	present: Extract<ChartPresent, { type: "pie" }>;
	result: InstrumentResult;
}) {
	const total = result.rows.reduce((sum, row) => {
		const value = Number(row[present.valueField]);
		return sum + (Number.isFinite(value) ? value : 0);
	}, 0);
	return (
		<div
			aria-hidden
			className="pointer-events-none absolute inset-0 flex -translate-y-[14px] flex-col items-center justify-center"
		>
			<span className="font-display text-3xl leading-none">
				{centerFormat.format(total)}
			</span>
			<span className="mt-1.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">
				{present.valueField}
			</span>
		</div>
	);
}
