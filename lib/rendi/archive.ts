import { triggerEnv } from "./trigger-env.ts";

// A conversation's durable session lives in the Trigger environment it
// was born in; the other environment can render every persisted row but
// never reach the session, so cross-environment opens become read-only
// galleries, in both directions. Rows older than the stamp were
// backfilled by the production cutover.
export function isArchived(bornEnv: string): boolean {
	return bornEnv !== triggerEnv();
}
