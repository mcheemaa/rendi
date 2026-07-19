import { anthropic } from "@ai-sdk/anthropic";
import { chat } from "@trigger.dev/sdk/ai";
import { stepCountIs, streamText } from "ai";

export const rendiChat = chat.agent({
	id: "rendi-chat",
	run: async ({ messages, signal }) => {
		return streamText({
			// Spread first: wires prepareStep (compaction, steering, injection),
			// the prompt surface, and telemetry. Overrides after the spread win.
			...chat.toStreamTextOptions(),
			model: anthropic(process.env.RENDI_MODEL ?? "claude-opus-4-8"),
			messages,
			abortSignal: signal,
			stopWhen: stepCountIs(15),
		});
	},
});
