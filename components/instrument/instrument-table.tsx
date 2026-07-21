"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useRef } from "react";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { InstrumentResult } from "@/lib/rendi/exec";
import { cn } from "@/lib/utils";

const NUMERIC_TYPE = /^(Nullable\()?(U?Int|Float|Decimal)/;
const ROW_HEIGHT = 33;
const numberFormat = new Intl.NumberFormat("en-US");

export function InstrumentTable({
	result,
	className,
}: {
	result: InstrumentResult;
	className?: string;
}) {
	const scroller = useRef<HTMLDivElement>(null);
	const virtualizer = useVirtualizer({
		count: result.rows.length,
		getScrollElement: () => scroller.current,
		estimateSize: () => ROW_HEIGHT,
		overscan: 12,
	});
	const items = virtualizer.getVirtualItems();
	// Spacer rows keep native table semantics (real column alignment, real
	// header scope) while the DOM holds only the visible window of a 10k
	// result.
	const top = items[0]?.start ?? 0;
	const bottom = virtualizer.getTotalSize() - (items.at(-1)?.end ?? 0);
	const numeric = result.columns.map((column) =>
		NUMERIC_TYPE.test(column.type),
	);

	return (
		<div ref={scroller} className={cn("max-h-80 overflow-auto", className)}>
			<Table className="font-mono text-xs">
				<TableHeader className="sticky top-0 z-10 bg-card">
					<TableRow className="hover:bg-transparent">
						{result.columns.map((column, index) => (
							<TableHead
								key={column.name}
								className={cn(
									"h-8 text-[10.5px] font-normal uppercase tracking-wider text-muted-foreground",
									numeric[index] && "text-right",
								)}
							>
								{column.name}
							</TableHead>
						))}
					</TableRow>
				</TableHeader>
				<TableBody>
					{top > 0 ? <tr aria-hidden style={{ height: top }} /> : null}
					{items.map((item) => {
						const row = result.rows[item.index];
						return (
							<TableRow key={item.index} className="hover:bg-muted/40">
								{result.columns.map((column, index) => (
									<TableCell
										key={column.name}
										className={cn(
											"max-w-64 truncate whitespace-nowrap py-1.5 tabular-nums",
											numeric[index] && "text-right",
										)}
									>
										{cell(row[column.name], numeric[index])}
									</TableCell>
								))}
							</TableRow>
						);
					})}
					{bottom > 0 ? <tr aria-hidden style={{ height: bottom }} /> : null}
				</TableBody>
			</Table>
		</div>
	);
}

function cell(value: unknown, isNumeric: boolean): string {
	if (value === null || value === undefined) return "";
	if (isNumeric) {
		const numeric = Number(value);
		if (Number.isFinite(numeric)) return numberFormat.format(numeric);
	}
	return String(value);
}
