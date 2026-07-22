import { task } from "@trigger.dev/sdk";
import { clickhouseAdmin } from "@/lib/rendi/clickhouse";
import {
	applyDetail,
	type CommitRow,
	mapListCommit,
	sinceCursor,
} from "@/lib/rendi/github-commits";
import { sendSessionText } from "@/lib/rendi/nudge";
import { REPO_CATALOG, type RepoEntry, repoBySlug } from "@/lib/rendi/repos";

const PAGE_SIZE = 100;
const MAX_PAGES = 10;
const MAX_DETAIL_CALLS = 300;

type SyncPayload = { slugs?: string[]; conversationId?: string };

function githubHeaders(): Record<string, string> {
	const headers: Record<string, string> = {
		Accept: "application/vnd.github+json",
		"User-Agent": "rendi-commit-sync",
	};
	const token = process.env.GITHUB_TOKEN;
	if (token) headers.Authorization = `Bearer ${token}`;
	return headers;
}

async function github<T>(path: string): Promise<T> {
	const response = await fetch(`https://api.github.com${path}`, {
		headers: githubHeaders(),
	});
	if (!response.ok) {
		throw new Error(`GitHub ${response.status} on ${path}`);
	}
	return (await response.json()) as T;
}

async function fetchNewCommits(
	admin: ReturnType<typeof clickhouseAdmin>,
	entry: RepoEntry,
	detailBudget: { left: number },
): Promise<CommitRow[]> {
	const result = await admin.query({
		query: `SELECT toUnixTimestamp(max(ts)) AS ts FROM git.commits WHERE repo = '${entry.repo}'`,
		format: "JSONEachRow",
	});
	const [cursor] = await result.json<{ ts: string }>();
	const since = sinceCursor(Number(cursor?.ts ?? 0));

	const rows: CommitRow[] = [];
	for (let page = 1; page <= MAX_PAGES; page += 1) {
		const batch = await github<Parameters<typeof mapListCommit>[1][]>(
			`/repos/${entry.github}/commits?since=${since}&per_page=${PAGE_SIZE}&page=${page}`,
		);
		rows.push(
			...batch
				.map((item) => mapListCommit(entry.repo, item))
				.filter((row) => row.ts > 0),
		);
		if (batch.length < PAGE_SIZE) break;
	}

	for (let i = 0; i < rows.length && detailBudget.left > 0; i += 1) {
		detailBudget.left -= 1;
		rows[i] = applyDetail(
			rows[i],
			await github(`/repos/${entry.github}/commits/${rows[i].sha}`),
		);
	}
	return rows;
}

// Refreshes git.commits from the GitHub API, cursored on each repo's
// newest known commit. Everything downstream of the cursor is
// idempotent: the hour of overlap and any retry collapse in the
// ReplacingMergeTree, so a sync that dies in one heartbeat heals on
// the next.
export const rendiSyncCommits = task({
	id: "rendi-sync-commits",
	queue: { concurrencyLimit: 1 },
	run: async (payload: SyncPayload) => {
		const entries = payload.slugs?.length
			? payload.slugs.map((slug) => {
					const entry = repoBySlug(slug);
					if (!entry) throw new Error(`unknown repo ${slug}`);
					return entry;
				})
			: REPO_CATALOG;

		const admin = clickhouseAdmin();
		const detailBudget = { left: MAX_DETAIL_CALLS };
		const synced: { slug: string; added: number }[] = [];
		const failures: string[] = [];

		for (const entry of entries) {
			try {
				const rows = await fetchNewCommits(admin, entry, detailBudget);
				if (rows.length > 0) {
					await admin.insert({
						table: "git.commits",
						values: rows,
						format: "JSONEachRow",
					});
				}
				synced.push({ slug: entry.slug, added: rows.length });
			} catch (error) {
				failures.push(`${entry.slug}: ${String(error).slice(0, 120)}`);
			}
		}

		if (synced.length === 0) {
			throw new Error(`every repo failed: ${failures.join("; ")}`);
		}
		await admin.command({ query: "OPTIMIZE TABLE git.commits FINAL" });

		if (payload.conversationId) {
			const report = synced.map((s) => `${s.slug}: ${s.added} new`).join(", ");
			const failed = failures.length ? ` Failed: ${failures.join("; ")}.` : "";
			await sendSessionText(
				payload.conversationId,
				`[commits synced] ${report}.${failed} Continue what the user asked for.`,
			).catch(() => {});
		}
		return { synced, failures };
	},
	onFailure: async ({ payload, error }) => {
		const { conversationId } = payload as SyncPayload;
		if (conversationId) {
			await sendSessionText(
				conversationId,
				`[commits sync failed] ${String(error).slice(0, 200)}. Tell the user plainly and decide what to do.`,
			).catch(() => {});
		}
	},
});
