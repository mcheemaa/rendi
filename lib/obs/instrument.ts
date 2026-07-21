import type { TaskSchema } from "@trigger.dev/sdk";
import type { ChatAgentOptions } from "@trigger.dev/sdk/ai";
import type { LanguageModelUsage, StepResult, ToolSet, UIMessage } from "ai";
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

// The structural minimum each hook needs; every ChatAgentOptions
// instantiation's events are supersets, so handlers typed against these
// assign into any instrumented definition.
type TurnStartBase = { chatId: string; turn: number; runId: string };
type TurnCompleteBase = TurnStartBase & {
	newUIMessages: Array<{ role: string }>;
	responseMessage?: unknown;
	usage?: LanguageModelUsage;
	finishReason?: string;
	stopped?: boolean;
	continuation?: boolean;
	error?: unknown;
};

export type AgentObservabilityOptions = {
	writer?: WriterConfig;
	model: () => string;
	// The host ends the agent span itself when it needs to order other
	// work (persistence, follow-up generations) around the emit;
	// otherwise instrument() closes the span after onTurnComplete,
	// errors included.
	manualTurnEnd?: boolean;
};

type StreamCallbacks = {
	onChunk?: (event: unknown) => void | PromiseLike<void>;
	onStepFinish?: (step: StepResult<ToolSet>) => void | PromiseLike<void>;
};

function endFromEvent(event: TurnCompleteBase, error?: unknown): void {
	endTurnSpan({
		...event,
		stopped: event.stopped ?? false,
		continuation: event.continuation ?? false,
		input: event.newUIMessages.filter((m) => m.role === "user"),
		output: event.responseMessage,
		error: event.error ?? error,
	});
}

export function createAgentObservability(options: AgentObservabilityOptions) {
	if (options.writer) configureWriter(options.writer);
	const { model, manualTurnEnd = false } = options;

	return {
		span: emitSpan,
		turnContext,
		recordTurnMessages,
		endTurnSpan,
		instrument<
			TId extends string,
			TClient extends TaskSchema | undefined,
			TMsg extends UIMessage,
			TAction extends TaskSchema | undefined,
			TTools extends ToolSet,
		>(
			definition: ChatAgentOptions<TId, TClient, TMsg, TAction, TTools>,
		): ChatAgentOptions<TId, TClient, TMsg, TAction, TTools> {
			const tools = definition.tools;
			return {
				...definition,
				tools:
					typeof tools === "function"
						? async (event: Parameters<typeof tools>[0]) =>
								instrumentTools(await tools(event))
						: tools
							? instrumentTools(tools)
							: tools,
				onTurnStart: async (event: TurnStartBase) => {
					// A telemetry failure must never fail the host's turn.
					try {
						beginTurnSpan(event, model());
					} catch (error) {
						console.error("[telemetry] beginTurnSpan failed", error);
					}
					await definition.onTurnStart?.(
						event as Parameters<NonNullable<typeof definition.onTurnStart>>[0],
					);
				},
				onTurnComplete: async (event: TurnCompleteBase) => {
					const rich = event as Parameters<
						NonNullable<typeof definition.onTurnComplete>
					>[0];
					if (manualTurnEnd) {
						await definition.onTurnComplete?.(rich);
						return;
					}
					try {
						await definition.onTurnComplete?.(rich);
					} catch (error) {
						endFromEvent(event, error);
						throw error;
					}
					endFromEvent(event);
				},
			};
		},
		// The host's own callbacks keep their original ordering.
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
