import { createClient } from "@clickhouse/client";
import type { LanguageModelUsage } from "ai";
import { priceUsage } from "./pricing.ts";
import type { Span } from "./span.ts";

export type WriterConfig = {
	url: string;
	password: string;
	username?: string;
	database?: string;
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

let explicitConfig: WriterConfig | undefined;
let client: ReturnType<typeof createClient> | null | undefined;
let warned = false;

export function configureWriter(config: WriterConfig): void {
	explicitConfig = config;
	const previous = client;
	client = undefined;
	warned = false;
	if (previous) void previous.close().catch(() => {});
}

function writerClient() {
	if (client !== undefined) return client;
	const config = explicitConfig ?? envConfig();
	if (!config) {
		client = null;
		if (!warned) {
			warned = true;
			const missing = [
				!process.env.CLICKHOUSE_URL && "CLICKHOUSE_URL",
				!process.env.CLICKHOUSE_TELEMETRY_PASSWORD &&
					"CLICKHOUSE_TELEMETRY_PASSWORD",
			].filter(Boolean);
			console.warn(`[telemetry] spans disabled: ${missing.join(", ")} unset`);
		}
		return client;
	}
	// A bad URL throws synchronously inside createClient; telemetry must
	// never break a turn, so it degrades to disabled instead.
	try {
		client = createClient({
			url: config.url,
			username: config.username ?? "agent_obs_writer",
			password: config.password,
			database: config.database ?? "agent_obs",
			clickhouse_settings: {
				async_insert: 1,
				wait_for_async_insert: 0,
				date_time_input_format: "best_effort",
			},
		});
	} catch (error) {
		client = null;
		if (!warned) {
			warned = true;
			console.error("[telemetry] spans disabled: invalid writer config", error);
		}
	}
	return client;
}

function envConfig(): WriterConfig | undefined {
	const url = process.env.CLICKHOUSE_URL;
	const password = process.env.CLICKHOUSE_TELEMETRY_PASSWORD;
	if (!url || !password) return undefined;
	return { url, password };
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
	const sink = writerClient();
	if (!sink) return;
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
