"use client";

import { InstrumentCard } from "@/components/chat/instrument-card";
import {
	OBSERVABILITY_CONVERSATION,
	observabilityInstruments,
} from "@/lib/rendi/observability";

const [overview, cost, ttft, tools, sessions] = observabilityInstruments;

// Rendi watching itself, rendered in its own vocabulary: every panel is a
// steerable instrument over the telemetry database.
export function ObservabilityView() {
	return (
		<div className="min-h-0 flex-1 overflow-y-auto">
			<div className="mx-auto flex max-w-5xl flex-col gap-4 px-6 py-8">
				<header>
					<h1 className="font-display text-3xl font-normal">Observability</h1>
					<p className="mt-1 text-sm text-muted-foreground">
						Every turn, generation, tool call, and dollar, live from ClickHouse.
						Steer any panel; the model stays out of the loop.
					</p>
				</header>
				<Panel instrument={overview} />
				<div className="grid gap-4 lg:grid-cols-2">
					<Panel instrument={cost} />
					<Panel instrument={ttft} />
				</div>
				<Panel instrument={tools} />
				<Panel instrument={sessions} />
			</div>
		</div>
	);
}

function Panel({
	instrument,
}: {
	instrument: (typeof observabilityInstruments)[number];
}) {
	return (
		<InstrumentCard
			instrument={instrument}
			conversationId={OBSERVABILITY_CONVERSATION}
			surface="observability"
		/>
	);
}
