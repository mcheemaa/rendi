import type { Tool, ToolSet } from "ai";
import { turnContext } from "./turn.ts";
import { emitSpan } from "./writer.ts";

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
				const turn = turnContext();
				const base = {
					conversationId: turn?.conversationId ?? "",
					turn: turn?.turn ?? 0,
					runId: turn?.runId,
					parentSpanId: turn?.spanId,
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
