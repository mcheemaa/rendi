import type { LanguageModelUsage } from "ai";

// Span model borrowed from Datadog LLM Observability: one event stream,
// span_kind discriminated, their metric vocabulary, full input/output on
// every span so an agent can debug itself from its own telemetry. The
// base kinds are the SDK's; consumers extend with their own strings (the
// host app's "query" and "image" kinds ride this path).
export type SpanKind = "agent" | "llm" | "tool" | (string & {});

export type Span = {
	conversationId: string;
	turn: number;
	spanKind: SpanKind;
	name: string;
	input?: unknown;
	output?: unknown;
	spanId?: string;
	parentSpanId?: string;
	runId?: string;
	model?: string;
	status?: "ok" | "error";
	errorMessage?: string;
	durationMs?: number;
	usage?: LanguageModelUsage;
	timeToFirstTokenMs?: number;
	finishReason?: string;
	stopped?: boolean;
	continuation?: boolean;
	toolCallId?: string;
	sqlHash?: string;
	resultRows?: number;
	readRows?: number;
	readBytes?: number;
	attrs?: Record<string, unknown>;
};
