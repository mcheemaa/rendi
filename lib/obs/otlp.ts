import { createHash } from "node:crypto";
import type { Span } from "./span.ts";

// OTLP/HTTP JSON export of the same spans the ClickHouse writer emits,
// for ClickStack or any OpenTelemetry collector. Off until configured;
// failures drop silently after one warning, telemetry never breaks a turn.

export type OtlpConfig = { url: string; serviceName?: string };

let config: OtlpConfig | undefined;
let warned = false;

export function configureOtlp(next: OtlpConfig): void {
	config = next;
}

const OPERATION: Record<string, string> = {
	agent: "invoke_agent",
	llm: "chat",
	tool: "execute_tool",
};

function hexId(value: string, bytes: number): string {
	return createHash("md5")
		.update(value)
		.digest("hex")
		.slice(0, bytes * 2);
}

function attr(key: string, value: string | number) {
	return typeof value === "number"
		? { key, value: { intValue: String(Math.round(value)) } }
		: { key, value: { stringValue: value } };
}

export function toOtlpPayload(span: Span, serviceName: string) {
	// One trace per turn: the trace id derives from the conversation and
	// turn, so the tree HyperDX shows matches the one the spans table holds.
	const traceId = hexId(`${span.conversationId}:${span.turn}`, 16);
	const million = BigInt(1_000_000);
	const endNs = BigInt(Date.now()) * million;
	const startNs = endNs - BigInt(Math.round(span.durationMs ?? 0)) * million;
	const attributes = [
		attr("gen_ai.operation.name", OPERATION[span.spanKind] ?? span.spanKind),
		attr("gen_ai.conversation.id", span.conversationId),
		attr("rendi.span_kind", span.spanKind),
		attr("rendi.turn", span.turn),
	];
	if (span.model) {
		attributes.push(attr("gen_ai.request.model", span.model));
	}
	if (span.usage?.inputTokens) {
		attributes.push(attr("gen_ai.usage.input_tokens", span.usage.inputTokens));
	}
	if (span.usage?.outputTokens) {
		attributes.push(
			attr("gen_ai.usage.output_tokens", span.usage.outputTokens),
		);
	}
	if (span.finishReason) {
		attributes.push(attr("gen_ai.response.finish_reasons", span.finishReason));
	}
	if (span.spanKind === "tool") {
		attributes.push(attr("gen_ai.tool.name", span.name));
	}
	return {
		resourceSpans: [
			{
				resource: {
					attributes: [attr("service.name", serviceName)],
				},
				scopeSpans: [
					{
						scope: { name: "trigger-agent-observability" },
						spans: [
							{
								traceId,
								spanId: hexId(span.spanId ?? crypto.randomUUID(), 8),
								...(span.parentSpanId
									? { parentSpanId: hexId(span.parentSpanId, 8) }
									: {}),
								name: span.name,
								kind: 1,
								startTimeUnixNano: String(startNs),
								endTimeUnixNano: String(endNs),
								attributes,
								status: { code: span.status === "error" ? 2 : 1 },
							},
						],
					},
				],
			},
		],
	};
}

export function exportOtlp(span: Span): void {
	if (!config) return;
	fetch(`${config.url}/v1/traces`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(
			toOtlpPayload(span, config.serviceName ?? "trigger-agent"),
		),
	}).catch((error) => {
		if (!warned) {
			warned = true;
			console.warn("[telemetry] otlp export failed", error);
		}
	});
}
