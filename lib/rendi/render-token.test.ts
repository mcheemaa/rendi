import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mintRenderToken, verifyRenderToken } from "./render-token.ts";

const original = process.env.RENDER_TOKEN_SECRET;

beforeEach(() => {
	process.env.RENDER_TOKEN_SECRET = "test-secret";
});

afterEach(() => {
	process.env.RENDER_TOKEN_SECRET = original;
});

describe("render tokens", () => {
	it("round-trips for the minted conversation", () => {
		const token = mintRenderToken("conv-1");
		expect(verifyRenderToken("conv-1", token)).toBe(true);
	});

	it("never opens another conversation's door", () => {
		const token = mintRenderToken("conv-1");
		expect(verifyRenderToken("conv-2", token)).toBe(false);
	});

	it("expires", () => {
		const token = mintRenderToken("conv-1", -1);
		expect(verifyRenderToken("conv-1", token)).toBe(false);
	});

	it("rejects tampered signatures", () => {
		const token = mintRenderToken("conv-1");
		expect(verifyRenderToken("conv-1", `${token}ff`)).toBe(false);
		expect(verifyRenderToken("conv-1", "garbage")).toBe(false);
	});
});
