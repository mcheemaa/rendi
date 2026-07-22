"use client";

import type { ToolUIPart } from "ai";
import { DatabaseZap } from "lucide-react";
import { useEffect, useState } from "react";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Tool, ToolContent, ToolHeader } from "@/components/ai-elements/tool";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type DatasetInput = { op?: "catalog" | "load" | "status"; slug?: string };

type CatalogEntry = {
	slug: string;
	title: string;
	description: string;
	status: string;
	rows_loaded: number;
	est_rows: number;
};

type DatasetOutput = {
	slug?: string;
	status?: string;
	rows_loaded?: number;
	est_rows?: number;
	error?: string | null;
	datasets?: CatalogEntry[];
};

type LiveState = {
	status: string;
	rowsLoaded: number;
	rowsEstimate: number;
	error: string | null;
	updatedAgoMs: number;
};

const STALLED_AFTER_MS = 45_000;

const numberFormat = new Intl.NumberFormat("en-US");

const TITLES = {
	catalog: "Datasets",
	load: "Loading a dataset",
	status: "Checked a load",
} as const;

// A load outlives its tool call: the card keeps polling the ingest row
// and the count climbs live until the table is ready.
export function DatasetCard({
	state,
	input,
	output,
	errorText,
	interrupted = false,
}: {
	state: ToolUIPart["state"];
	input?: DatasetInput;
	output?: DatasetOutput;
	errorText?: string;
	interrupted?: boolean;
}) {
	const op = input?.op ?? "load";
	const slug = output?.slug ?? input?.slug;
	const [live, setLive] = useState<LiveState | null>(null);

	// A loading row a live ingest has not touched in this long belongs to
	// a run that died without marking itself failed; stop asking.
	const stalled =
		live?.status === "loading" && live.updatedAgoMs > STALLED_AFTER_MS;
	const loading =
		op === "load" &&
		output?.status === "loading" &&
		(!live || live.status === "loading") &&
		!stalled;

	useEffect(() => {
		if (!loading || !slug) return;
		const timer = setInterval(async () => {
			try {
				const response = await fetch(`/api/datasets/${slug}`);
				const row = (await response.json()) as LiveState | null;
				if (row) setLive(row);
			} catch {
				// The next tick retries.
			}
		}, 1500);
		return () => clearInterval(timer);
	}, [loading, slug]);

	const rows = live?.rowsLoaded ?? output?.rows_loaded ?? 0;
	const estimate = live?.rowsEstimate ?? output?.est_rows ?? 0;
	const settled = live?.status === "ready" || output?.status === "ready";
	const failed = live?.status === "failed" || stalled;

	return (
		<Tool defaultOpen className="bg-card">
			<ToolHeader
				type="tool-load-dataset"
				state={state}
				title={op === "load" && slug ? `Loading ${slug}` : TITLES[op]}
				icon={<DatabaseZap className="size-3.5 text-muted-foreground" />}
				summary={
					<span
						className={cn(
							"font-mono text-xs",
							errorText || failed
								? "text-destructive"
								: "text-muted-foreground",
						)}
					>
						{headerSummary(op, output, rows, settled, failed, errorText)}
					</span>
				}
			/>
			<ToolContent>
				<div className="border-t px-3 py-3">
					{errorText ? (
						<p className="font-mono text-xs text-destructive">{errorText}</p>
					) : output ? (
						<DatasetBody
							op={op}
							output={output}
							rows={rows}
							estimate={estimate}
							settled={settled}
							failed={failed}
							liveError={
								stalled
									? "load stalled: the run died mid-flight. Ask to load again."
									: (live?.error ?? null)
							}
						/>
					) : interrupted ? (
						<p className="font-mono text-xs text-muted-foreground">
							interrupted
						</p>
					) : (
						<Shimmer className="font-mono text-xs">
							talking to clickhouse
						</Shimmer>
					)}
				</div>
			</ToolContent>
		</Tool>
	);
}

function headerSummary(
	op: keyof typeof TITLES,
	output: DatasetOutput | undefined,
	rows: number,
	settled: boolean,
	failed: boolean,
	errorText?: string,
): string {
	if (errorText || failed) return "failed";
	if (!output) return "working";
	if (op === "catalog") {
		const count = output.datasets?.length ?? 0;
		return `${count} ${count === 1 ? "dataset" : "datasets"}`;
	}
	if (settled) return `${numberFormat.format(rows)} rows · ready`;
	return `${numberFormat.format(rows)} rows in`;
}

function DatasetBody({
	op,
	output,
	rows,
	estimate,
	settled,
	failed,
	liveError,
}: {
	op: keyof typeof TITLES;
	output: DatasetOutput;
	rows: number;
	estimate: number;
	settled: boolean;
	failed: boolean;
	liveError: string | null;
}) {
	if (op === "catalog") {
		return (
			<ul className="space-y-2.5">
				{output.datasets?.map((entry) => (
					<li key={entry.slug} className="text-sm">
						<div className="flex items-baseline gap-2">
							<span className="font-medium">{entry.title}</span>
							<span className="font-mono text-[10.5px] text-muted-foreground">
								{entry.status === "ready"
									? `${numberFormat.format(entry.rows_loaded)} rows`
									: entry.status}
							</span>
						</div>
						<p className="mt-0.5 text-xs text-muted-foreground">
							{entry.description}
						</p>
					</li>
				))}
			</ul>
		);
	}
	if (failed) {
		return (
			<p className="font-mono text-xs text-destructive">
				{liveError ?? output.error ?? "load failed"}
			</p>
		);
	}
	if (settled) {
		return (
			<p className="font-mono text-xs text-muted-foreground">
				{numberFormat.format(rows)} rows, live and queryable.
			</p>
		);
	}
	const share = estimate > 0 ? Math.min(100, (rows / estimate) * 100) : 0;
	return (
		<div>
			<Progress value={share} aria-label="Rows loaded" />
			<p className="mt-2 font-mono text-xs text-muted-foreground">
				{numberFormat.format(rows)} of ~{numberFormat.format(estimate)} rows
			</p>
		</div>
	);
}
