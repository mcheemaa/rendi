// Absolute URLs from here persist into durable documents, so production
// must never fall back to a guess.
export function appBase(): string {
	const base = process.env.RENDI_APP_URL;
	if (base) return base;
	if (process.env.NODE_ENV === "production") {
		throw new Error("RENDI_APP_URL must be set: persisted URLs depend on it");
	}
	return "http://localhost:3000";
}
