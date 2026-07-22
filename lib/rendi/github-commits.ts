// Maps GitHub's commits API onto git.commits rows. The list endpoint
// carries everything except churn; a per-commit detail call fills
// additions and deletions. Kept pure so the sync task stays thin and
// the mapping is testable without a network.

export type CommitRow = {
	repo: string;
	sha: string;
	ts: number;
	author: string;
	author_email: string;
	subject: string;
	body: string;
	files_changed: number;
	additions: number;
	deletions: number;
	is_merge: number;
};

type ListCommit = {
	sha: string;
	parents: unknown[];
	commit: {
		author: { name?: string; email?: string; date?: string } | null;
		message: string;
	};
};

type CommitDetail = {
	stats?: { additions?: number; deletions?: number };
	files?: unknown[];
};

export function mapListCommit(repo: string, item: ListCommit): CommitRow {
	const [subject = "", ...rest] = item.commit.message.split("\n");
	return {
		repo,
		sha: item.sha,
		ts: Math.floor(Date.parse(item.commit.author?.date ?? "") / 1000) || 0,
		author: item.commit.author?.name ?? "",
		author_email: item.commit.author?.email ?? "",
		subject,
		body: rest.join("\n").trim().slice(0, 2000),
		files_changed: 0,
		additions: 0,
		deletions: 0,
		is_merge: item.parents.length > 1 ? 1 : 0,
	};
}

export function applyDetail(row: CommitRow, detail: CommitDetail): CommitRow {
	return {
		...row,
		files_changed: detail.files?.length ?? 0,
		additions: detail.stats?.additions ?? 0,
		deletions: detail.stats?.deletions ?? 0,
	};
}

// The cursor rewinds an hour so clock skew and race windows re-fetch a
// little overlap; the ReplacingMergeTree collapses the duplicates.
export function sinceCursor(maxTsSeconds: number): string {
	const OVERLAP_S = 3600;
	return new Date(Math.max(0, maxTsSeconds - OVERLAP_S) * 1000).toISOString();
}
