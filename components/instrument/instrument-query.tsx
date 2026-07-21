"use client";

import { CodeBlock } from "@/components/ai-elements/code-block";
import type { InstrumentResult } from "@/lib/rendi/exec";
import { cn } from "@/lib/utils";

const numberFormat = new Intl.NumberFormat("en-US");

export function InstrumentQuery({
	sql,
	stats,
	error,
}: {
	sql: string;
	stats?: InstrumentResult["stats"];
	error?: string | null;
}) {
	return (
		<div className="space-y-3 px-4 pb-4">
			<div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs text-muted-foreground">
				<span
					className={cn(
						"inline-flex items-center gap-1.5 font-medium",
						error ? "text-destructive" : "text-live",
					)}
				>
					<span
						aria-hidden
						className={cn(
							"size-1.5 rounded-full",
							error ? "bg-destructive" : "bg-live",
						)}
					/>
					{error ? "Failed" : "Completed"}
				</span>
				{stats ? (
					<>
						<span>
							<b className="font-medium text-foreground">{stats.elapsedMs}</b>{" "}
							ms
						</span>
						<span>server {stats.serverElapsedMs} ms</span>
						<span>
							read{" "}
							<b className="font-medium text-foreground">
								{numberFormat.format(stats.rowsRead)}
							</b>{" "}
							rows
						</span>
						<span>{(stats.bytesRead / 1048576).toFixed(2)} MB</span>
					</>
				) : null}
			</div>
			<CodeBlock code={sql} language="sql" />
			{error ? (
				<p className="whitespace-pre-wrap font-mono text-xs text-destructive">
					{error}
				</p>
			) : null}
		</div>
	);
}
