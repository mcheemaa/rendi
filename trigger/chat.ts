import { anthropic } from "@ai-sdk/anthropic";
import { chat } from "@trigger.dev/sdk/ai";
import type { StepResult, ToolSet } from "ai";
import { streamText } from "ai";
import { parseAgentDefinition, resolveTools } from "@/lib/rendi/definition";
import { addCacheBreaks } from "@/lib/rendi/harness/cache";
import {
	canvasStateBlock,
	markCanvasOpsSeen,
} from "@/lib/rendi/harness/canvas-readback";
import {
	persistChatStart,
	persistTurnComplete,
	persistTurnStart,
} from "@/lib/rendi/harness/persistence";
import {
	instrumentStateBlock,
	markOpsSeen,
	withInstrumentState,
} from "@/lib/rendi/harness/readback";
import {
	beginTurnSpan,
	emitGenerationSpan,
	endTurnSpan,
	instrumentTools,
	markFirstToken,
	recordTurnMessages,
	turnContext,
} from "@/lib/rendi/harness/telemetry";
import { maybeUpdateTitle } from "@/lib/rendi/harness/titles";
import agentSource from "./rendi/agent.md";
import { toolRegistry } from "./tools";

const definition = parseAgentDefinition(agentSource);
const tools = instrumentTools(resolveTools(toolRegistry, definition.tools));
const model = () => process.env.RENDI_MODEL ?? definition.model;

export const rendiChat = chat.agent({
	id: "rendi-chat",
	tools,
	onChatStart: async (event) => {
		await persistChatStart(event);
	},
	onTurnStart: async (event) => {
		beginTurnSpan(event, model());
		await persistTurnStart(event);
	},
	onTurnComplete: async (event) => {
		// Telemetry closes before anything can throw: a persistence failure
		// must land as span facts, never blind the turn. Titles run after the
		// span so their latency stays out of the turn's duration.
		let persistError: unknown;
		try {
			await persistTurnComplete(event);
		} catch (error) {
			persistError = error;
		}
		// At-least-once: a marking failure just re-delivers next turn.
		await markOpsSeen(event.chatId, event.turn).catch((error) =>
			console.error("[readback] mark seen failed", error),
		);
		await markCanvasOpsSeen(event.chatId, event.turn).catch((error) =>
			console.error("[canvas-readback] mark seen failed", error),
		);
		const titleParent = turnContext()?.spanId;
		endTurnSpan({
			...event,
			input: event.newUIMessages.filter((m) => m.role === "user"),
			output: event.responseMessage,
			error: event.error ?? persistError,
		});
		await maybeUpdateTitle(event, titleParent);
		if (persistError) throw persistError;
	},
	uiMessageStreamOptions: {
		// A data tool's error text is the product; never mask it.
		onError: (error) =>
			error instanceof Error ? error.message : String(error),
	},
	run: async ({ messages, tools, signal }) => {
		// The spread wires prepareStep (compaction, steering, injection),
		// declared tools, and telemetry; typed loosely by the SDK, so the
		// callbacks we compose with are narrowed here. Overrides after the
		// spread win.
		const base = chat.toStreamTextOptions({ tools }) as Record<
			string,
			unknown
		> & {
			onChunk?: (event: unknown) => void | PromiseLike<void>;
			onStepFinish?: (step: StepResult<ToolSet>) => void | PromiseLike<void>;
		};
		// Property 4: the user's hands on the instruments and the canvas,
		// injected at the tail so the cached prefix stays byte-identical.
		// Order: instrument state, canvas state, the newest user message.
		const turn = turnContext();
		const [instrumentState, canvasState] = turn
			? await Promise.all([
					instrumentStateBlock(turn.conversationId),
					canvasStateBlock(turn.conversationId),
				])
			: [undefined, undefined];
		const staged = withInstrumentState(
			withInstrumentState(messages, instrumentState),
			canvasState,
		);
		const cachedMessages = addCacheBreaks(staged);
		recordTurnMessages(cachedMessages);
		return streamText({
			...base,
			model: anthropic(model()),
			system: definition.system,
			messages: cachedMessages,
			abortSignal: signal,
			providerOptions: {
				// Adaptive thinking with visible summaries: omitted display would
				// think silently, and watching Rendi reason is part of the product.
				anthropic: { thinking: { type: "adaptive", display: "summarized" } },
			},
			onChunk: (event) => {
				markFirstToken((event as { chunk?: { type?: string } }).chunk?.type);
				return base.onChunk?.(event);
			},
			onStepFinish: async (step) => {
				await base.onStepFinish?.(step);
				emitGenerationSpan(step);
			},
			// The AI SDK's default stopWhen is a one-step cap. Rendi never caps
			// steps: the run ends only when the model finishes on its own.
			stopWhen: () => false,
		});
	},
});
