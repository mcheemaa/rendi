"use client";

import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import type { Instrument } from "@/lib/rendi/instrument";

// The instrument shell per the chart-spike anatomy: serif title, param
// chips, the SQL, stats footer. M3 drops the live chart into the well.
export function InstrumentCard({ instrument }: { instrument: Instrument }) {
	return (
		<Card className="gap-0 overflow-hidden py-0">
			<CardHeader className="flex-row items-center gap-2.5 border-b px-4 py-3 [.border-b]:pb-3">
				<CardTitle className="font-display text-lg font-normal leading-none">
					{instrument.title}
				</CardTitle>
				<Badge variant="outline" className="font-mono text-[10px]">
					v{instrument.version}
				</Badge>
			</CardHeader>
			<CardContent className="px-0">
				{instrument.params.length > 0 ? (
					<div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5">
						{instrument.params.map((param) => (
							<Badge
								key={param.name}
								variant="secondary"
								className="gap-1 font-mono text-[11px] font-normal"
							>
								<span className="text-muted-foreground">{param.name}</span>
								{param.defaultValue}
							</Badge>
						))}
					</div>
				) : null}
				<pre className="overflow-x-auto whitespace-pre-wrap bg-muted/40 px-4 py-3 font-mono text-xs leading-relaxed text-foreground/90">
					{instrument.sql}
				</pre>
			</CardContent>
			<CardFooter className="justify-between border-t px-4 py-2 font-mono text-[11px] text-muted-foreground [.border-t]:pt-2">
				<span>
					{instrument.chart
						? `${instrument.chart.type} · ${instrument.chart.xField} × ${instrument.chart.yField}`
						: "table"}
				</span>
				<span>rendi sees how you steer this</span>
			</CardFooter>
		</Card>
	);
}
