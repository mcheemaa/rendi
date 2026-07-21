import { configureWriter } from "@/lib/obs/writer.ts";

// The observability core lives in lib/obs (Trigger Agent Observability);
// this alias keeps existing import paths stable and pins Rendi's writer
// identity, which both the worker and the Next process load before any
// span can emit.
const url = process.env.CLICKHOUSE_URL;
const password = process.env.CLICKHOUSE_TELEMETRY_PASSWORD;
if (url && password) {
	configureWriter({
		url,
		password,
		username: "rendi_telemetry_writer",
		database: "rendi_telemetry",
	});
}

export type { Span, SpanKind } from "@/lib/obs/span.ts";
export { instrumentTools } from "@/lib/obs/tools.ts";
export {
	beginTurnSpan,
	emitGenerationSpan,
	endTurnSpan,
	markFirstToken,
	recordTurnMessages,
	turnContext,
} from "@/lib/obs/turn.ts";
export { emitSpan } from "@/lib/obs/writer.ts";
