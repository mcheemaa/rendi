import { describe, expect, it } from "vitest";
import { toOtlpPayload } from "./otlp.ts";

describe("otlp mapping", () => {
	it("maps a tool span to gen_ai conventions with turn-scoped trace ids", () => {
		const payload = toOtlpPayload(
			{
				conversationId: "c1",
				turn: 3,
				spanKind: "tool",
				name: "query-data",
				spanId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
				parentSpanId: "11111111-2222-3333-4444-555555555555",
				durationMs: 240,
				status: "ok",
			},
			"rendi",
		);
		const span = payload.resourceSpans[0].scopeSpans[0].spans[0];
		expect(span.traceId).toMatch(/^[0-9a-f]{32}$/);
		expect(span.spanId).toMatch(/^[0-9a-f]{16}$/);
		expect(span.parentSpanId).toMatch(/^[0-9a-f]{16}$/);
		const attrs = Object.fromEntries(
			span.attributes.map((a) => [a.key, a.value]),
		);
		expect(attrs["gen_ai.operation.name"]).toEqual({
			stringValue: "execute_tool",
		});
		expect(attrs["gen_ai.tool.name"]).toEqual({ stringValue: "query-data" });
		expect(attrs["gen_ai.conversation.id"]).toEqual({ stringValue: "c1" });
	});

	it("keeps one trace per turn and marks errors", () => {
		const spanFor = (turn: number, status?: "ok" | "error") =>
			toOtlpPayload(
				{
					conversationId: "c1",
					turn,
					spanKind: "llm",
					name: "step-1",
					status,
				},
				"rendi",
			).resourceSpans[0].scopeSpans[0].spans[0];
		expect(spanFor(1).traceId).toBe(spanFor(1).traceId);
		expect(spanFor(1).traceId).not.toBe(spanFor(2).traceId);
		expect(spanFor(1, "error").status).toEqual({ code: 2 });
	});
});
