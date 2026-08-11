// A durable chat session lives forever in the Trigger environment it was
// born in; the other environment can render its rows but never reach the
// session. Both the Next server and the workers learn their own
// environment from the secret key they already hold, so no extra
// configuration exists to drift.
const KEY_PATTERN = /^tr_([a-z]+)_/;

export function envFromKey(key: string): string {
	const match = KEY_PATTERN.exec(key);
	if (!match) throw new Error("TRIGGER_SECRET_KEY has no environment prefix");
	return match[1];
}

export function triggerEnv(): string {
	const key = process.env.TRIGGER_SECRET_KEY;
	if (!key) throw new Error("TRIGGER_SECRET_KEY is not set");
	return envFromKey(key);
}
