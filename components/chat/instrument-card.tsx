"use client";

import { Shimmer } from "@/components/ai-elements/shimmer";
import { InstrumentChart } from "@/components/instrument/instrument-chart";
import { InstrumentQuery } from "@/components/instrument/instrument-query";
import { InstrumentStat } from "@/components/instrument/instrument-stat";
import { InstrumentTable } from "@/components/instrument/instrument-table";
import { ParamControls } from "@/components/instrument/param-controls";
import { useInstrument } from "@/components/instrument/use-instrument";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { InstrumentResult } from "@/lib/rendi/exec";
import { type Instrument, presentOf } from "@/lib/rendi/instrument";

const numberFormat = new Intl.NumberFormat("en-US");

// The chat container for an instrument: composes the hook and the views and
// owns only chrome. The canvas block later composes the same layers.
export function InstrumentCard({
	instrument,
	conversationId,
	surface,
}: {
	instrument: Instrument;
	conversationId: string;
	surface?: "chat" | "observability";
}) {
	const shape = presentOf(instrument);
	const { values, result, error, running, steer } = useInstrument(
		instrument,
		conversationId,
		surface,
	);

	return (
		<Card className="gap-0 overflow-hidden py-0">
			<Tabs defaultValue={shape.kind === "table" ? "table" : "chart"}>
				<CardHeader className="flex-row items-center gap-2.5 border-b px-4 py-3 [.border-b]:pb-3">
					<CardTitle className="font-display text-lg font-normal leading-none">
						{instrument.title}
					</CardTitle>
					<Badge variant="outline" className="font-mono text-[10px]">
						v{instrument.version}
					</Badge>
					{running && result ? (
						<Spinner className="size-3.5 text-muted-foreground" />
					) : null}
					<TabsList className="ml-auto h-8">
						{shape.kind !== "table" ? (
							<TabsTrigger value="chart" className="px-3 text-xs">
								{shape.kind === "stat" ? "Stats" : "Chart"}
							</TabsTrigger>
						) : null}
						<TabsTrigger value="table" className="px-3 text-xs">
							Table
						</TabsTrigger>
						<TabsTrigger value="query" className="px-3 text-xs">
							Query
						</TabsTrigger>
					</TabsList>
				</CardHeader>
				<CardContent className="px-0">
					<ParamControls
						params={instrument.params}
						values={values}
						onSteer={steer}
						busy={running}
					/>
					{shape.kind === "chart" ? (
						<TabsContent value="chart" className="px-2 pt-2">
							{result ? (
								<InstrumentChart
									present={shape}
									result={result}
									title={instrument.title}
								/>
							) : (
								<Pending error={error} tall />
							)}
						</TabsContent>
					) : null}
					{shape.kind === "stat" ? (
						<TabsContent value="chart" className="px-3 py-3">
							{result ? (
								<InstrumentStat present={shape} result={result} />
							) : (
								<Pending error={error} />
							)}
						</TabsContent>
					) : null}
					<TabsContent value="table" className="pt-1">
						{result ? (
							<InstrumentTable result={result} />
						) : (
							<Pending error={error} />
						)}
					</TabsContent>
					<TabsContent value="query" className="pt-3">
						<InstrumentQuery
							sql={instrument.sql}
							stats={result?.stats}
							error={error}
						/>
					</TabsContent>
				</CardContent>
				<CardFooter className="justify-between border-t px-4 py-2 font-mono text-[11px] text-muted-foreground [.border-t]:pt-2">
					<span>rendi sees how you steer this</span>
					<ResultSummary result={result} />
				</CardFooter>
			</Tabs>
		</Card>
	);
}

function Pending({
	error,
	tall = false,
}: {
	error: string | null;
	tall?: boolean;
}) {
	return (
		<div
			className={`flex items-center justify-center px-4 ${tall ? "h-[340px]" : "h-32"}`}
		>
			{error ? (
				<p className="max-w-full whitespace-pre-wrap font-mono text-xs text-destructive">
					{error}
				</p>
			) : (
				<Shimmer className="font-mono text-xs">
					running against clickhouse
				</Shimmer>
			)}
		</div>
	);
}

function ResultSummary({ result }: { result: InstrumentResult | null }) {
	if (!result) return null;
	return (
		<span>
			{numberFormat.format(result.rows.length)}{" "}
			{result.rows.length === 1 ? "row" : "rows"} · {result.stats.elapsedMs} ms
		</span>
	);
}
