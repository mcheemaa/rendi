"use client";

import type { InstrumentResult } from "@/lib/rendi/exec";
import type { Present } from "@/lib/rendi/instrument";

type StatPresent = Extract<Present, { kind: "stat" }>;

const numberFormat = new Intl.NumberFormat("en-US", {
	maximumFractionDigits: 2,
});

function formatValue(raw: unknown, unit?: string): string {
	const value = Number(raw);
	const text = Number.isFinite(value)
		? numberFormat.format(value)
		: String(raw);
	if (unit === "$") return `$${text}`;
	return unit ? `${text} ${unit}` : text;
}

// One tile per row, long format: the label column names the tile, the
// value column fills it.
export function InstrumentStat({
	present,
	result,
}: {
	present: StatPresent;
	result: InstrumentResult;
}) {
	const seen = new Map<string, number>();
	return (
		<div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-4">
			{result.rows.map((row) => {
				const label = present.labelField
					? String(row[present.labelField])
					: present.valueField;
				const occurrence = seen.get(label) ?? 0;
				seen.set(label, occurrence + 1);
				return (
					<div
						key={occurrence === 0 ? label : `${label}#${occurrence}`}
						className="bg-card px-4 py-3"
					>
						<div className="font-display text-2xl leading-tight">
							{formatValue(row[present.valueField], present.unit)}
						</div>
						<div className="mt-1 truncate font-mono text-[10px] tracking-[0.12em] text-muted-foreground uppercase">
							{label}
						</div>
					</div>
				);
			})}
		</div>
	);
}
