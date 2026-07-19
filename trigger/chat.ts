import { anthropic } from "@ai-sdk/anthropic";
import { chat } from "@trigger.dev/sdk/ai";
import { streamText } from "ai";
import { parseAgentDefinition, resolveTools } from "@/lib/rendi/definition";
import agentSource from "./rendi/agent.md";
import { toolRegistry } from "./tools";

const definition = parseAgentDefinition(agentSource);
const tools = resolveTools(toolRegistry, definition.tools);

export const rendiChat = chat.agent({
	id: "rendi-chat",
	tools,
	run: async ({ messages, tools, signal }) => {
		return streamText({
			// Spread first: wires prepareStep (compaction, steering, injection),
			// declared tools, and telemetry. Overrides after the spread win.
			...chat.toStreamTextOptions({ tools }),
			model: anthropic(process.env.RENDI_MODEL ?? definition.model),
			system: definition.system,
			messages,
			abortSignal: signal,
			// The AI SDK's default stopWhen is a one-step cap. Rendi never caps
			// steps: the run ends only when the model finishes on its own.
			stopWhen: () => false,
		});
	},
});
