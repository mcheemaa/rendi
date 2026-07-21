"use client";

import { useEffect, useRef } from "react";
import { ambientWave } from "@/components/home/miniature";
import { type ECharts, echarts } from "@/lib/rendi/charts/echarts";
import { useEmberTokens } from "@/lib/rendi/charts/tokens";

const REDRAW_MS = 14_000;

// The quiet amber terrain behind the lower half of the home page. The
// top-fade mask is what makes it read as behind the content, not on it.
export function AmbientWave() {
	const host = useRef<HTMLDivElement>(null);
	const chart = useRef<ECharts | null>(null);
	const seed = useRef(0);
	const tokens = useEmberTokens();

	useEffect(() => {
		if (!host.current) return;
		const instance = echarts.init(host.current, null, { renderer: "svg" });
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
		const reduced = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		const draw = () => {
			chart.current?.setOption(ambientWave(tokens, seed.current++, !reduced), {
				notMerge: true,
			});
		};
		draw();
		if (reduced) return;
		const interval = setInterval(() => {
			if (!document.hidden) draw();
		}, REDRAW_MS);
		return () => clearInterval(interval);
	}, [tokens]);

	return (
		<div
			aria-hidden
			className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[64%] [mask-image:linear-gradient(to_top,black_55%,transparent)]"
		>
			<div ref={host} className="size-full" />
		</div>
	);
}
