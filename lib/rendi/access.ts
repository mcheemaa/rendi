// The deployed instance's door key: an HMAC over its own expiry, minted
// when a visitor presents a valid access code and carried as a cookie
// for thirty days. WebCrypto only, because verification runs in
// middleware at the edge where node:crypto does not exist.

export const ACCESS_COOKIE = "rendi_access";
export const ACCESS_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const encoder = new TextEncoder();

async function sign(secret: string, expiresAt: number): Promise<string> {
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const bytes = await crypto.subtle.sign(
		"HMAC",
		key,
		encoder.encode(`access:${expiresAt}`),
	);
	return Array.from(new Uint8Array(bytes), (byte) =>
		byte.toString(16).padStart(2, "0"),
	).join("");
}

export async function mintAccessToken(secret: string): Promise<string> {
	const expiresAt = Date.now() + ACCESS_TTL_MS;
	return `${expiresAt}.${await sign(secret, expiresAt)}`;
}

export async function verifyAccessToken(
	secret: string,
	token: string,
): Promise<boolean> {
	const [expiry, signature] = token.split(".");
	const expiresAt = Number(expiry);
	if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;
	if (!signature) return false;
	const expected = await sign(secret, expiresAt);
	if (signature.length !== expected.length) return false;
	let diff = 0;
	for (let i = 0; i < expected.length; i += 1) {
		diff |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
	}
	return diff === 0;
}
