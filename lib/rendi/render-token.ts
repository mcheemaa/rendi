import { createHmac, timingSafeEqual } from "node:crypto";

// The render route is chromeless and shell-free, so it is gated by a
// short-lived HMAC instead of a session: only holders of the server secret
// (the screenshot tool) can mint a look at a canvas.

function secret(): string {
	const value = process.env.RENDER_TOKEN_SECRET;
	if (!value) throw new Error("RENDER_TOKEN_SECRET is not set");
	return value;
}

function sign(conversationId: string, expiresAt: number): string {
	return createHmac("sha256", secret())
		.update(`${conversationId}:${expiresAt}`)
		.digest("hex");
}

export function mintRenderToken(
	conversationId: string,
	ttlMs = 120_000,
): string {
	const expiresAt = Date.now() + ttlMs;
	return `${expiresAt}.${sign(conversationId, expiresAt)}`;
}

export function verifyRenderToken(
	conversationId: string,
	token: string,
): boolean {
	const [expiry, signature] = token.split(".");
	const expiresAt = Number(expiry);
	if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
	if (!signature) return false;
	const expected = sign(conversationId, expiresAt);
	const a = Buffer.from(signature);
	const b = Buffer.from(expected);
	return a.length === b.length && timingSafeEqual(a, b);
}
