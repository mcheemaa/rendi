import { describe, expect, it } from "vitest";
import { heartbeatMessage, PULSE_MARKER, turnLooksInFlight } from "./pulse.ts";

describe("heartbeat", () => {
	it("marks the message and carries the instruction verbatim", () => {
		const message = heartbeatMessage(
			"0 9 * * *",
			"Refresh the board and note anything unusual.",
		);
		expect(message.role).toBe("user");
		const [part] = message.parts;
		if (part.type !== "text") throw new Error("wrong part");
		expect(part.text).toBe(
			"[pulse 0 9 * * *] Refresh the board and note anything unusual.",
		);
		expect(part.text.startsWith(PULSE_MARKER)).toBe(true);
	});

	it("mints a fresh message id per beat", () => {
		expect(heartbeatMessage("* * * * *", "x").id).not.toBe(
			heartbeatMessage("* * * * *", "x").id,
		);
	});
});

describe("turnLooksInFlight", () => {
	it("holds the beat when the newest message is user-role", () => {
		expect(turnLooksInFlight({ role: "user" })).toBe(true);
	});

	it("beats on assistant-quiet conversations, empty included", () => {
		expect(turnLooksInFlight({ role: "assistant" })).toBe(false);
		expect(turnLooksInFlight(undefined)).toBe(false);
	});
});
