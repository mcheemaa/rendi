import { sessions } from "@trigger.dev/sdk";

// Background work wakes the agent by sending a marked user message into
// the conversation's durable session; the append-time probe re-triggers
// an idle or dead run, so nudges land with every browser closed. Callers
// that retry pass their own id so a commit-then-lost-response send stays
// one message instead of waking the agent once per attempt.
export async function sendSessionText(
	conversationId: string,
	text: string,
	id?: string,
): Promise<string> {
	const messageId = id ?? crypto.randomUUID();
	await sessions.open(conversationId).in.send({
		kind: "message",
		payload: {
			chatId: conversationId,
			trigger: "submit-message",
			messageId,
			message: {
				id: messageId,
				role: "user",
				parts: [{ type: "text", text }],
			},
		},
	});
	return messageId;
}
