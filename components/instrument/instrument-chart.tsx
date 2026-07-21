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

	return (
		<div
			ref={host}
			className="h-[340px] w-full"
			role="img"
			aria-label={title}
		/>
	);
}
