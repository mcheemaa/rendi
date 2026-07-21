import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Span } from "./span.ts";

const emitted: Span[] = [];
vi.mock("./writer.ts", () => ({
	emitSpan: (span: Span) => {
		emitted.push(span);
	},
	configureWriter: vi.fn(),
}));

import { createAgentObservability } from "./instrument.ts";

const turnEvent = { chatId: "c1", turn: 1, runId: "r1" };
const completeEvent = {
	...turnEvent,
	newUIMessages: [{ role: "user" }, { role: "assistant" }],
	responseMessage: { role: "assistant" },
	stopped: false,
	continuation: false,
};

function freshObs(manualTurnEnd = false) {
	return createAgentObservability({ model: () => "test-model", manualTurnEnd });
}

beforeEach(() => {
	emitted.length = 0;
});

describe("instrument", () => {
	it("opens the turn and closes it with input and output", async () => {
		const obs = freshObs();
		const wrapped = obs.instrument({
			id: "a" as const,
			run: (() => {}) as never,
		});
		await wrapped.onTurnStart?.(turnEvent as never);
		expect(obs.turnContext()?.conversationId).toBe("c1");
		await wrapped.onTurnComplete?.(completeEvent as never);
		const agent = emitted.find((span) => span.spanKind === "agent");
		expect(agent?.model).toBe("test-model");
		expect(agent?.input).toEqual([{ role: "user" }]);
		expect(agent?.output).toEqual({ role: "assistant" });
	});

	it("emits exactly one agent span when the runtime re-fires onTurnComplete", async () => {
		const obs = freshObs();
		const failing = obs.instrument({
			id: "a" as const,
			run: (() => {}) as never,
			onTurnComplete: async () => {
				throw new Error("persist failed");
			},
		});
		await failing.onTurnStart?.({ ...turnEvent, turn: 2 } as never);
		await expect(
			failing.onTurnComplete?.({ ...completeEvent, turn: 2 } as never),
		).rejects.toThrow("persist failed");
		// The runtime's error path invokes the hook a second time.
		await expect(
			failing.onTurnComplete?.({
				...completeEvent,
				turn: 2,
				error: new Error("persist failed"),
			} as never),
		).rejects.toThrow("persist failed");
		const agents = emitted.filter((span) => span.spanKind === "agent");
		expect(agents).toHaveLength(1);
		expect(agents[0].status).toBe("error");
		expect(agents[0].input).toEqual([{ role: "user" }]);
	});

	it("leaves the turn open under manualTurnEnd", async () => {
		const obs = freshObs(true);
		const wrapped = obs.instrument({
			id: "a" as const,
			run: (() => {}) as never,
		});
		await wrapped.onTurnStart?.({ ...turnEvent, turn: 3 } as never);
		await wrapped.onTurnComplete?.({ ...completeEvent, turn: 3 } as never);
		expect(emitted.filter((span) => span.spanKind === "agent")).toHaveLength(0);
		obs.endTurnSpan({ ...completeEvent, turn: 3 });
		expect(emitted.filter((span) => span.spanKind === "agent")).toHaveLength(1);
	});

	it("wraps tool sets and per-turn resolvers alike", async () => {
		const obs = freshObs();
		const tool = {
			execute: async () => "done",
		};
		const set = obs.instrument({
			id: "a" as const,
			run: (() => {}) as never,
			tools: { probe: tool } as never,
		});
		await wrappedExecute(set.tools, "probe");
		const resolver = obs.instrument({
			id: "b" as const,
			run: (() => {}) as never,
			tools: (async () => ({ probe: tool })) as never,
		});
		await wrappedExecute(
			await (resolver.tools as (e: unknown) => Promise<unknown>)({}),
			"probe",
		);
		const toolSpans = emitted.filter((span) => span.spanKind === "tool");
		expect(toolSpans).toHaveLength(2);
		expect(toolSpans.every((span) => span.output === "done")).toBe(true);
	});

	it("orders the host's onStepFinish before the llm span", async () => {
		const obs = freshObs();
		const wrapped = obs.instrument({
			id: "a" as const,
			run: (() => {}) as never,
		});
		await wrapped.onTurnStart?.({ ...turnEvent, turn: 5 } as never);
		const order: string[] = [];
		const callbacks = obs.generationTelemetry({
			onStepFinish: async () => {
				order.push("host");
			},
		});
		await callbacks.onStepFinish?.({
			response: { modelId: "m", messages: [] },
			content: [],
			usage: {},
			finishReason: "stop",
		} as never);
		order.push(
			emitted.some((span) => span.spanKind === "llm")
				? "llm-emitted"
				: "missing",
		);
		expect(order).toEqual(["host", "llm-emitted"]);
	});
});

async function wrappedExecute(tools: unknown, name: string) {
	const set = tools as Record<
		string,
		{ execute: (input: unknown, options: unknown) => Promise<unknown> }
	>;
	await set[name].execute({}, { toolCallId: "t1" });
}
