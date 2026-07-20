import { createClient } from "@clickhouse/client";
import type { LanguageModelUsage, StepResult, Tool, ToolSet } from "ai";
import { priceUsage } from "./pricing.ts";

// Span model borrowed from Datadog LLM Observability (see
// local research note): one event stream, span_kind discriminated,
// their metric vocabulary verbatim, and full input/output on every
// span so the agent can debug itself from its own telemetry.
export type SpanKind = "agent" | "llm" | "tool" | "query";

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

const IO_CAP = 100_000;

// Telemetry rows must survive any value: circular, huge, or hostile
// input serializes to a capped string instead of failing the emit.
function serializeIO(value: unknown): string {
	if (value === undefined) return "";
	let encoded: string;
	try {
		encoded = typeof value === "string" ? value : JSON.stringify(value);
	} catch {
		encoded = String(value);
	}
	if (encoded === undefined) return "";
	return encoded.length > IO_CAP
		? `${encoded.slice(0, IO_CAP)}...[truncated]`
		: encoded;
}

let client: ReturnType<typeof createClient> | null | undefined;
let warned = false;

function telemetryClient() {
	if (client !== undefined) return client;
	const url = process.env.CLICKHOUSE_URL;
	const password = process.env.CLICKHOUSE_TELEMETRY_PASSWORD;
	if (!url || !password) {
		client = null;
		return client;
	}
	client = createClient({
		url,
		username: "rendi_telemetry_writer",
		password,
		database: "rendi_telemetry",
		clickhouse_settings: {
			async_insert: 1,
			wait_for_async_insert: 0,
			date_time_input_format: "best_effort",
		},
	});
	return client;
}

function tokenColumns(usage?: LanguageModelUsage) {
	return {
		input_tokens: usage?.inputTokens ?? 0,
		output_tokens: usage?.outputTokens ?? 0,
		total_tokens: usage?.totalTokens ?? 0,
		reasoning_output_tokens: usage?.outputTokenDetails?.reasoningTokens ?? 0,
		cache_read_input_tokens: usage?.inputTokenDetails?.cacheReadTokens ?? 0,
		cache_write_input_tokens: usage?.inputTokenDetails?.cacheWriteTokens ?? 0,
	};
}

function costColumns(model?: string, usage?: LanguageModelUsage) {
	const { usd, known } = priceUsage(model, usage);
	return { cost_usd: usd, cost_known: known ? 1 : 0 };
}

// Telemetry must never break a turn: failures log and drop.
export function emitSpan(span: Span): void {
	const sink = telemetryClient();
	if (!sink) {
		if (!warned) {
			warned = true;
			console.warn(
				"[telemetry] CLICKHOUSE_TELEMETRY_PASSWORD unset, spans disabled",
			);
		}
		return;
	}
	sink
		.insert({
			table: "spans",
			format: "JSONEachRow",
			values: [
				{
					ts: new Date().toISOString(),
					conversation_id: span.conversationId,
					turn: span.turn,
					run_id: span.runId ?? "",
					span_id: span.spanId ?? crypto.randomUUID(),
					parent_span_id: span.parentSpanId ?? "",
					span_kind: span.spanKind,
					name: span.name,
					model: span.model ?? "",
					status: span.status ?? "ok",
					error_message: span.errorMessage ?? "",
					duration_ms: Math.round(span.durationMs ?? 0),
					input: serializeIO(span.input),
					output: serializeIO(span.output),
					...tokenColumns(span.usage),
					...costColumns(span.model, span.usage),
					time_to_first_token_ms: Math.round(span.timeToFirstTokenMs ?? 0),
					finish_reason: span.finishReason ?? "",
					stopped: span.stopped ? 1 : 0,
					continuation: span.continuation ? 1 : 0,
					tool_call_id: span.toolCallId ?? "",
					sql_hash: span.sqlHash ?? "",
					result_rows: span.resultRows ?? 0,
					read_rows: span.readRows ?? 0,
					read_bytes: span.readBytes ?? 0,
					attrs: JSON.stringify(span.attrs ?? {}),
				},
			],
		})
		.catch((error) => console.error("[telemetry] span insert failed", error));
}

type TurnContext = {
	conversationId: string;
	turn: number;
	runId: string;
	model: string;
	spanId: string;
	startedAt: number;
	firstTokenAt?: number;
	steps: number;
	baseMessages?: unknown[];
	stepResponses: unknown[];
	stepAnchorAt: number;
	stepFirstTokenAt?: number;
};

// One run per worker process and turns are sequential within it, so a
// module singleton is a safe carrier for the active turn.
let activeTurn: TurnContext | undefined;

export function beginTurnSpan(
	event: { chatId: string; turn: number; runId: string },
	model: string,
): void {
	activeTurn = {
		conversationId: event.chatId,
		turn: event.turn,
		runId: event.runId,
		model,
		spanId: crypto.randomUUID(),
		startedAt: performance.now(),
		steps: 0,
		stepResponses: [],
		stepAnchorAt: performance.now(),
	};
}

export function turnContext():
	| { conversationId: string; turn: number; runId: string; spanId: string }
	| undefined {
	if (!activeTurn) return undefined;
	const { conversationId, turn, runId, spanId } = activeTurn;
	return { conversationId, turn, runId, spanId };
}

// The model input per step is composed from data already in hand:
// run()'s messages plus each prior step's response messages.
export function recordTurnMessages(messages: unknown[]): void {
	if (!activeTurn) return;
	activeTurn.baseMessages = messages;
	activeTurn.stepAnchorAt = performance.now();
}

// TTFT means model output; stream plumbing chunks (start parts, tool
// input deltas) arrive milliseconds after connect and must not count.
export function markFirstToken(chunkType?: string): void {
	if (!activeTurn) return;
	if (chunkType !== "text-delta" && chunkType !== "reasoning-delta") return;
	activeTurn.firstTokenAt ??= performance.now();
	activeTurn.stepFirstTokenAt ??= performance.now();
}

export function emitGenerationSpan(step: StepResult<ToolSet>): void {
	const turn = activeTurn;
	if (!turn) return;
	turn.steps += 1;
	const now = performance.now();
	emitSpan({
		conversationId: turn.conversationId,
		turn: turn.turn,
		runId: turn.runId,
		parentSpanId: turn.spanId,
		spanKind: "llm",
		name: `step-${turn.steps}`,
		model: step.response.modelId,
		input: [...(turn.baseMessages ?? []), ...turn.stepResponses],
		output: step.content,
		usage: step.usage,
		finishReason: step.finishReason,
		durationMs: now - turn.stepAnchorAt,
		timeToFirstTokenMs:
			turn.stepFirstTokenAt !== undefined
				? turn.stepFirstTokenAt - turn.stepAnchorAt
				: 0,
	});
	turn.stepResponses.push(...step.response.messages);
	turn.stepAnchorAt = now;
	turn.stepFirstTokenAt = undefined;
}

export function endTurnSpan(event: {
	chatId: string;
	turn: number;
	runId: string;
	input?: unknown;
	output?: unknown;
	usage?: LanguageModelUsage;
	finishReason?: string;
	stopped: boolean;
	continuation: boolean;
	error?: unknown;
}): void {
	const turn = activeTurn;
	activeTurn = undefined;
	const now = performance.now();
	emitSpan({
		conversationId: event.chatId,
		turn: event.turn,
		runId: event.runId,
		spanId: turn?.spanId,
		spanKind: "agent",
		name: "turn",
		model: turn?.model,
		input: event.input,
		output: event.output,
		status: event.error ? "error" : "ok",
		errorMessage: event.error ? String(event.error) : "",
		durationMs: turn ? now - turn.startedAt : 0,
		timeToFirstTokenMs:
			turn?.firstTokenAt !== undefined ? turn.firstTokenAt - turn.startedAt : 0,
		usage: event.usage,
		finishReason: event.finishReason,
		stopped: event.stopped,
		continuation: event.continuation,
	});
}

export function instrumentTools<T extends ToolSet>(tools: T): T {
	const wrapped: ToolSet = {};
	for (const [name, definition] of Object.entries(tools)) {
		const execute = definition.execute;
		if (!execute) {
			wrapped[name] = definition;
			continue;
		}
		wrapped[name] = {
			...definition,
			execute: async (input, options) => {
				const startedAt = performance.now();
				const base = {
					conversationId: activeTurn?.conversationId ?? "",
					turn: activeTurn?.turn ?? 0,
					runId: activeTurn?.runId,
					parentSpanId: activeTurn?.spanId,
					spanKind: "tool" as const,
					name,
					toolCallId: options.toolCallId,
					input,
				};
				try {
					const result = await execute(input, options);
					emitSpan({
						...base,
						output: result,
						durationMs: performance.now() - startedAt,
					});
					return result;
				} catch (error) {
					emitSpan({
						...base,
						output: String(error),
						durationMs: performance.now() - startedAt,
						status: "error",
						errorMessage: String(error),
					});
					throw error;
				}
			},
		} as Tool;
	}
	return wrapped as T;
}
