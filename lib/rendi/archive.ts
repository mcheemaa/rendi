// Conversations born before the production cutover rode the dev
// environment; a deployed instance cannot reach those sessions, so it
// shows them as read-only galleries. Locally (no gate configured) they
// stay live, because the dev environment is right there. Time plus
// deployment is the whole test: nothing born after the cutover can ever
// be archived, so new conversations are safe by construction.
const ARCHIVE_CUTOVER = Date.parse("2026-07-22T20:40:00Z");

export function isArchived(createdAt: Date): boolean {
	if (!process.env.ACCESS_TOKEN_SECRET) return false;
	return createdAt.getTime() < ARCHIVE_CUTOVER;
}
