import type { LanguageModelUsage, StepResult, ToolSet } from "ai";
import { emitSpan } from "./writer.ts";

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
let lastEnded: { chatId: string; turn: number } | undefined;

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
	// The runtime re-fires onTurnComplete on its error path; one turn
	// gets one agent span regardless.
	if (
		!turn &&
		lastEnded?.chatId === event.chatId &&
		lastEnded.turn === event.turn
	) {
		return;
	}
	lastEnded = { chatId: event.chatId, turn: event.turn };
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
