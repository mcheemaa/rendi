import type { UIMessage } from "ai";

// Persistence is authoritative for settled turns; the live stream is
// authoritative for the in-flight tail. Merging by id honors both:
// persisted rows in persisted order, then any local messages the server
// has not seen yet (a streaming reply, an optimistic send). Turns that
// start without this tab (pulse beats, dataset nudges) arrive as new
// persisted rows, so adopting the merge is all a poller has to do.
export function mergeTranscript(
	local: UIMessage[],
	server: UIMessage[],
): { messages: UIMessage[]; changed: boolean } {
	if (server.length === 0) return { messages: local, changed: false };
	const serverIds = new Set(server.map((message) => message.id));
	const tail = local.filter((message) => !serverIds.has(message.id));
	const changed =
		local.length !== server.length + tail.length ||
		server.some((message, index) => local[index]?.id !== message.id);
	if (!changed) return { messages: local, changed: false };
	return { messages: [...server, ...tail], changed: true };
}
