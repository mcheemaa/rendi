"use client";

import type { EChartsCoreOption } from "echarts/core";
import { useEffect, useRef } from "react";
import { type ECharts, echarts } from "@/lib/rendi/charts/echarts";

// Fixed-size decorative mount: no resize observer, SVG always. Instruments
// keep their own richer mount in components/instrument.
export function MiniChart({
	option,
	className,
}: {
	option: EChartsCoreOption;
	className?: string;
}) {
	const host = useRef<HTMLDivElement>(null);
	const chart = useRef<ECharts | null>(null);

	useEffect(() => {
		if (!host.current) return;
		const instance = echarts.init(host.current, null, { renderer: "svg" });
		chart.current = instance;
		return () => {
			instance.dispose();
			chart.current = null;
		};
	}, []);

	useEffect(() => {
		chart.current?.setOption(option, { notMerge: true });
	}, [option]);

	return <div ref={host} className={className} />;
}
