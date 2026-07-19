import { chat } from "@trigger.dev/sdk/ai";
import { tool } from "ai";
import { type Instrument, instrumentSpec } from "@/lib/rendi/instrument";

export const renderInstrument = tool({
	description:
		"Render the answer as a live instrument: a parameterized ClickHouse query plus a chart spec. This is how you answer data questions; the interface is the answer.",
	inputSchema: instrumentSpec,
	execute: async (spec) => {
		const instrument: Instrument = {
			id: crypto.randomUUID(),
			version: 1,
			...spec,
		};
		chat.response.write({
			type: "data-instrument",
			id: instrument.id,
			data: instrument,
		});
		return { instrumentId: instrument.id, status: "rendered" };
	},
});
