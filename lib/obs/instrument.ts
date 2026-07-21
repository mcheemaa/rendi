import type { ChatAgentOptions } from "@trigger.dev/sdk/ai";
import type { StepResult, ToolSet, UIMessage } from "ai";
import { instrumentTools } from "./tools.ts";
import {
	beginTurnSpan,
	emitGenerationSpan,
	endTurnSpan,
	markFirstToken,
	recordTurnMessages,
	turnContext,
} from "./turn.ts";
import { configureWriter, emitSpan, type WriterConfig } from "./writer.ts";

type AnyAgentOptions = ChatAgentOptions<
	string,
	undefined,
	UIMessage,
	undefined,
	ToolSet
>;
type TurnStartEvent = Parameters<
	NonNullable<AnyAgentOptions["onTurnStart"]>
>[0];
type TurnCompleteEvent = Parameters<
	NonNullable<AnyAgentOptions["onTurnComplete"]>
>[0];

export type AgentObservabilityOptions = {
	writer?: WriterConfig;
	model: () => string;
	// The host ends the agent span itself when it needs to order other
	// work (titles, persistence) around the emit; otherwise instrument()
	// closes the span after onTurnComplete, errors included.
	manualTurnEnd?: boolean;
};

type StreamCallbacks = {
	onChunk?: (event: unknown) => void | PromiseLike<void>;
	onStepFinish?: (step: StepResult<ToolSet>) => void | PromiseLike<void>;
};

// tools may be a set or a per-turn resolver; both come back instrumented.
function wrapDefinitionTools(
	tools: AnyAgentOptions["tools"],
): AnyAgentOptions["tools"] {
	if (!tools) return tools;
	if (typeof tools === "function") {
		return async (event) => instrumentTools(await tools(event));
	}
	return instrumentTools(tools);
}

export function createAgentObservability(options: AgentObservabilityOptions) {
	if (options.writer) configureWriter(options.writer);
	const { model, manualTurnEnd = false } = options;

	return {
		span: emitSpan,
		turnContext,
		recordTurnMessages,
		endTurnSpan,
		instrument<T extends AnyAgentOptions>(definition: T): T {
			return {
				...definition,
				tools: wrapDefinitionTools(definition.tools),
				onTurnStart: async (event: TurnStartEvent) => {
					beginTurnSpan(event, model());
					await definition.onTurnStart?.(event);
				},
				onTurnComplete: async (event: TurnCompleteEvent) => {
					if (manualTurnEnd) {
						await definition.onTurnComplete?.(event);
						return;
					}
					try {
						await definition.onTurnComplete?.(event);
					} catch (error) {
						endTurnSpan({ ...event, error: event.error ?? error });
						throw error;
					}
					endTurnSpan({
						...event,
						input: event.newUIMessages.filter((m) => m.role === "user"),
						output: event.responseMessage,
					});
				},
			};
		},
		// Weaves TTFT and per-step llm spans into streamText callbacks; the
		// host's own callbacks keep their original ordering.
		generationTelemetry(callbacks: StreamCallbacks): StreamCallbacks {
			return {
				onChunk: (event) => {
					markFirstToken((event as { chunk?: { type?: string } }).chunk?.type);
					return callbacks.onChunk?.(event);
				},
				onStepFinish: async (step) => {
					await callbacks.onStepFinish?.(step);
					emitGenerationSpan(step);
				},
			};
		},
	};
}
