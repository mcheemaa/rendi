// The observability core lives in lib/obs (Trigger Agent Observability);
// this alias keeps every existing import path stable.
export type { Span, SpanKind } from "@/lib/obs";
export {
	beginTurnSpan,
	emitGenerationSpan,
	emitSpan,
	endTurnSpan,
	instrumentTools,
	markFirstToken,
	recordTurnMessages,
	turnContext,
} from "@/lib/obs";
