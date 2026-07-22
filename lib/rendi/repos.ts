// The repositories whose engineering history lives in git.commits.
// Extending the product to watch another repo is one entry here: the
// sync tool's schema, the task's allowlist, and the agent's vocabulary
// all derive from this catalog.
export type RepoEntry = {
	slug: string;
	repo: string;
	github: string;
	title: string;
};

export const REPO_CATALOG: RepoEntry[] = [
	{
		slug: "clickhouse",
		repo: "ClickHouse",
		github: "ClickHouse/ClickHouse",
		title: "ClickHouse",
	},
	{
		slug: "trigger.dev",
		repo: "trigger.dev",
		github: "triggerdotdev/trigger.dev",
		title: "Trigger.dev",
	},
	{
		slug: "rendi",
		repo: "rendi",
		github: "mcheemaa/rendi",
		title: "Rendi",
	},
];

export function repoBySlug(slug: string): RepoEntry | undefined {
	return REPO_CATALOG.find((entry) => entry.slug === slug);
}
