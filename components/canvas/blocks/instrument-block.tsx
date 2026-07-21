"use client";

import { useEffect, useRef } from "react";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { InstrumentChart } from "@/components/instrument/instrument-chart";
import { InstrumentTable } from "@/components/instrument/instrument-table";
import { ParamControls } from "@/components/instrument/param-controls";
import { presentOf } from "@/lib/rendi/instrument";
import { useCanvas } from "../canvas-context";
import {
	type InstrumentBlock,
	useCanvasInstrument,
} from "../use-canvas-instrument";

// The container swap the M3 layering promised: same views, same controls,
// with the document as the single source of param truth. A steer dispatches
// through the reducer; the new paramState re-executes the block.
export function InstrumentBlockBody({ block }: { block: InstrumentBlock }) {
	const { store, conversationId } = useCanvas();
	const { result, error, running } = useCanvasInstrument(block, conversationId);
	const host = useRef<HTMLDivElement>(null);
	const shape = presentOf(block.instrument);

	// Error is as terminal as data: the block is fully painted either way,
	// and the agent's look must be allowed to see a failed card rather than
	// time out blind on it.
	useEffect(() => {
		if ((result || error) && host.current) {
			host.current.dataset.blockReady = "true";
		}
	}, [result, error]);

	return (
		<div ref={host} className="flex h-full flex-col">
			<div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
				<span className="truncate font-display text-sm leading-none">
					{block.instrument.title}
				</span>
			</div>
			<div data-no-drag>
				<ParamControls
					params={block.instrument.params}
					values={block.paramState}
					onSteer={(param, value) =>
						store.dispatch(
							{ op: "update_params", id: block.id, values: { [param]: value } },
							"user",
						)
					}
					busy={running}
				/>
			</div>
			<div className="min-h-0 flex-1 p-1.5">
				{result ? (
					shape.kind === "chart" ? (
						<InstrumentChart
							present={shape}
							result={result}
							title={block.instrument.title}
							className="h-full"
						/>
					) : (
						<InstrumentTable result={result} className="h-full max-h-none" />
					)
				) : (
					<div className="flex h-full items-center justify-center px-3">
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
				)}
			</div>
		</div>
	);
}
