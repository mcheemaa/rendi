import { describe, expect, it } from "vitest";
import { ACCESS_TTL_MS, mintAccessToken, verifyAccessToken } from "./access.ts";

const SECRET = "test-secret";

describe("access tokens", () => {
	it("round-trips a freshly minted token", async () => {
		const token = await mintAccessToken(SECRET);
		expect(await verifyAccessToken(SECRET, token)).toBe(true);
	});

	it("rejects a tampered signature", async () => {
		const token = await mintAccessToken(SECRET);
		const [expiry, signature] = token.split(".");
		const flipped = (signature[0] === "0" ? "1" : "0") + signature.slice(1);
		expect(await verifyAccessToken(SECRET, `${expiry}.${flipped}`)).toBe(false);
	});

	it("rejects a token signed with another secret", async () => {
		const token = await mintAccessToken("other-secret");
		expect(await verifyAccessToken(SECRET, token)).toBe(false);
	});

	it("rejects an expired token", async () => {
		const expired = Date.now() - 1000;
		const token = `${expired}.deadbeef`;
		expect(await verifyAccessToken(SECRET, token)).toBe(false);
	});

	it("rejects a forged expiry on a valid-shape token", async () => {
		const token = await mintAccessToken(SECRET);
		const [, signature] = token.split(".");
		const forged = `${Date.now() + 2 * ACCESS_TTL_MS}.${signature}`;
		expect(await verifyAccessToken(SECRET, forged)).toBe(false);
	});

	it("rejects garbage", async () => {
		expect(await verifyAccessToken(SECRET, "")).toBe(false);
		expect(await verifyAccessToken(SECRET, "not-a-token")).toBe(false);
		expect(await verifyAccessToken(SECRET, "123.")).toBe(false);
	});
});
