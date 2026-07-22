import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { mergeTranscript } from "./transcript-merge.ts";

function message(id: string, role: "user" | "assistant"): UIMessage {
	return { id, role, parts: [{ type: "text", text: id }] };
}

describe("mergeTranscript", () => {
	it("reports unchanged when ids already align", () => {
		const local = [message("u1", "user"), message("a1", "assistant")];
		const server = [message("u1", "user"), message("a1", "assistant")];
		const result = mergeTranscript(local, server);
		expect(result.changed).toBe(false);
		expect(result.messages).toBe(local);
	});

	it("adopts rows the server appended out of band", () => {
		const local = [message("u1", "user"), message("a1", "assistant")];
		const server = [...local, message("nudge", "user")];
		const result = mergeTranscript(local, server);
		expect(result.changed).toBe(true);
		expect(result.messages.map((m) => m.id)).toEqual(["u1", "a1", "nudge"]);
	});

	it("keeps the local streaming tail after adopted rows", () => {
		const local = [
			message("u1", "user"),
			message("a1", "assistant"),
			message("streaming", "assistant"),
		];
		const server = [
			message("u1", "user"),
			message("a1", "assistant"),
			message("nudge", "user"),
		];
		const result = mergeTranscript(local, server);
		expect(result.messages.map((m) => m.id)).toEqual([
			"u1",
			"a1",
			"nudge",
			"streaming",
		]);
	});

	it("keeps an optimistic send the server has not persisted", () => {
		const local = [message("u1", "user")];
		const result = mergeTranscript(local, []);
		expect(result.changed).toBe(false);
		expect(result.messages).toBe(local);
	});

	it("adopts server order when the server reordered rows", () => {
		const local = [
			message("u1", "user"),
			message("a1", "assistant"),
			message("a2", "assistant"),
		];
		const server = [
			message("u1", "user"),
			message("a2", "assistant"),
			message("a1", "assistant"),
		];
		const result = mergeTranscript(local, server);
		expect(result.changed).toBe(true);
		expect(result.messages.map((m) => m.id)).toEqual(["u1", "a2", "a1"]);
	});

	it("keeps local-only rows when the server returns fewer", () => {
		const local = [
			message("u1", "user"),
			message("a1", "assistant"),
			message("local-only", "assistant"),
		];
		const server = [message("u1", "user"), message("a1", "assistant")];
		const result = mergeTranscript(local, server);
		expect(result.changed).toBe(false);
		expect(result.messages).toBe(local);
	});

	it("prefers server payloads for rows both sides know", () => {
		const stale = message("a1", "assistant");
		stale.parts = [{ type: "text", text: "duplicated parts" }];
		const clean = message("a1", "assistant");
		const local = [message("u1", "user"), stale];
		const server = [message("u1", "user"), clean, message("nudge", "user")];
		const result = mergeTranscript(local, server);
		expect(result.messages[1]).toBe(clean);
	});
});
