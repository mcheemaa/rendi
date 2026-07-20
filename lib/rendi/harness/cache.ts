import type { ModelMessage } from "ai";

// The SDK docs sketch chat.addCacheBreaks but 4.5.4 does not ship it,
// so the harness owns the breakpoint: marking the final message caches
// the entire prefix (tools, system, history) for the next turn.
export function addCacheBreaks(messages: ModelMessage[]): ModelMessage[] {
	if (messages.length === 0) return messages;
	return messages.map((message, index) =>
		index === messages.length - 1
			? {
					...message,
					providerOptions: {
						...message.providerOptions,
						anthropic: {
							...message.providerOptions?.anthropic,
							cacheControl: { type: "ephemeral" },
						},
					},
				}
			: message,
	);
}
