"use client";

import type { ToolUIPart } from "ai";
import { Database } from "lucide-react";
import { CodeBlock } from "@/components/ai-elements/code-block";
import { Tool, ToolContent, ToolHeader } from "@/components/ai-elements/tool";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

const PREVIEW_ROWS = 8;

type QueryOutput = {
	rows?: Record<string, unknown>[];
	rowCount?: number;
	truncated?: boolean;
	stats?: { elapsedMs?: number; readRows?: number };
};

// The agent's hands, both directions: the exact SQL it ran and the
// rows the tool actually returned.
export function QueryDataCard({
	sql,
	state,
	output,
	errorText,
	interrupted = false,
}: {
	sql: string;
	state: ToolUIPart["state"];
	output?: QueryOutput;
	errorText?: string;
	interrupted?: boolean;
}) {
	return (
		<Tool className="bg-card">
			<ToolHeader
				type="tool-query-data"
				state={state}
				title="Looked at the data"
				icon={<Database className="size-3.5 text-muted-foreground" />}
				summary={
					<span
						className={cn(
							"font-mono text-xs",
							errorText ? "text-destructive" : "text-muted-foreground",
						)}
					>
						{headerSummary(output, errorText, interrupted)}
					</span>
				}
			/>
			<ToolContent>
				<div className="space-y-3 border-t px-3 py-3">
					<CodeBlock code={sql} language="sql" />
					{errorText ? (
						<p className="font-mono text-xs text-destructive">{errorText}</p>
					) : (
						<ResultTable
							rows={output?.rows}
							rowCount={output?.rowCount}
							truncated={output?.truncated}
						/>
					)}
				</div>
			</ToolContent>
		</Tool>
	);
}

function headerSummary(
	output?: QueryOutput,
	errorText?: string,
	interrupted = false,
): string {
	if (errorText) return "failed";
	if (!output) return interrupted ? "interrupted" : "running";
	const count = output.rowCount ?? 0;
	const rows = `${count} ${count === 1 ? "row" : "rows"}`;
	const marks = [
		output.truncated ? "truncated" : "",
		output.stats?.elapsedMs !== undefined ? `${output.stats.elapsedMs}ms` : "",
	].filter(Boolean);
	return [rows, ...marks].join(" · ");
}

function ResultTable({
	rows,
	rowCount,
	truncated,
}: {
	rows?: Record<string, unknown>[];
	rowCount?: number;
	truncated?: boolean;
}) {
	if (!rows || rows.length === 0) {
		return <p className="font-mono text-xs text-muted-foreground">no rows</p>;
	}
	const columns = Object.keys(rows[0]);
	const remaining =
		(rowCount ?? rows.length) - Math.min(rows.length, PREVIEW_ROWS);
	// Result rows carry no identity and can repeat verbatim, so keys come
	// from content disambiguated by occurrence count.
	const seen = new Map<string, number>();
	const preview = rows.slice(0, PREVIEW_ROWS).map((row) => {
		const content = columns.map((column) => String(row[column] ?? "")).join("");
		const occurrence = seen.get(content) ?? 0;
		seen.set(content, occurrence + 1);
		return {
			row,
			key: occurrence === 0 ? content : `${content}#${occurrence}`,
		};
	});
	return (
		<div className="overflow-x-auto">
			<Table className="font-mono text-xs">
				<TableHeader>
					<TableRow className="hover:bg-transparent">
						{columns.map((column) => (
							<TableHead
								key={column}
								className="h-8 text-[10.5px] font-normal uppercase tracking-wider text-muted-foreground"
							>
								{column}
							</TableHead>
						))}
					</TableRow>
				</TableHeader>
				<TableBody>
					{preview.map(({ row, key }) => (
						<TableRow key={key} className="hover:bg-muted/40">
							{columns.map((column) => (
								<TableCell
									key={column}
									className="max-w-64 truncate py-1.5 tabular-nums"
								>
									{String(row[column] ?? "")}
								</TableCell>
							))}
						</TableRow>
					))}
				</TableBody>
			</Table>
			{remaining > 0 || truncated ? (
				<p className="pt-1.5 font-mono text-xs text-muted-foreground">
					{remaining > 0 ? `and ${remaining} more` : "truncated at 500 rows"}
				</p>
			) : null}
		</div>
	);
}
