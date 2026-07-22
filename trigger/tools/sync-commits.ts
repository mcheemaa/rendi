import { tasks } from "@trigger.dev/sdk";
import { tool } from "ai";
import { z } from "zod";
import { turnContext } from "@/lib/rendi/harness/telemetry";
import { REPO_CATALOG } from "@/lib/rendi/repos";
import type { rendiSyncCommits } from "../sync-commits";

const slugs = REPO_CATALOG.map((entry) => entry.slug) as [string, ...string[]];

export const syncCommits = tool({
	description: `Refresh the git database with the latest commits from GitHub. Repos: ${slugs.join(", ")}; omit repos to refresh them all. Durable and idempotent: say what you started, end your turn, and a [commits synced] message wakes you with the counts. Write it into a pulse instruction for standing watches (fresh commits every beat, then judge whether anything is worth reporting).`,
	inputSchema: z.object({
		repos: z
			.array(z.enum(slugs))
			.optional()
			.describe("Which repos to refresh; all of them when omitted"),
	}),
	execute: async ({ repos }) => {
		await tasks.trigger<typeof rendiSyncCommits>(
			"rendi-sync-commits",
			{
				slugs: repos,
				conversationId: turnContext()?.conversationId,
			},
			{ concurrencyKey: "commit-sync" },
		);
		return { started: true, repos: repos ?? slugs };
	},
});
