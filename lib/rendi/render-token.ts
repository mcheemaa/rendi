import { createHmac, timingSafeEqual } from "node:crypto";

// Chromeless routes are gated by scoped HMACs instead of sessions: short
// render tokens for the screenshot tool, week-long share tokens for links.

export type TokenScope = "render" | "share";

export const SHARE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function secret(): string {
	const value = process.env.RENDER_TOKEN_SECRET;
	if (!value) throw new Error("RENDER_TOKEN_SECRET is not set");
	return value;
}

function sign(scope: TokenScope, conversationId: string, expiresAt: number) {
	return createHmac("sha256", secret())
		.update(`${scope}:${conversationId}:${expiresAt}`)
		.digest("hex");
}

export function mintRenderToken(
	conversationId: string,
	ttlMs = 120_000,
	scope: TokenScope = "render",
): string {
	const expiresAt = Date.now() + ttlMs;
	return `${expiresAt}.${sign(scope, conversationId, expiresAt)}`;
}

export function verifyRenderToken(
	conversationId: string,
	token: string,
	scope: TokenScope = "render",
): boolean {
	const [expiry, signature] = token.split(".");
	const expiresAt = Number(expiry);
	if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
	if (!signature) return false;
	const expected = sign(scope, conversationId, expiresAt);
	const a = Buffer.from(signature);
	const b = Buffer.from(expected);
	return a.length === b.length && timingSafeEqual(a, b);
}
