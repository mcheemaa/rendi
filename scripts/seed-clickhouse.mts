// Seeds git history into ClickHouse, one row per commit, reading only
// commit objects so partial clones (blobless, treeless) backfill fine.
// Churn columns stay zero here; the commit sync task fills them for new
// commits from the GitHub API, where diffs are precomputed. The table
// is a derived artifact of this script: schema changes ship by dropping
// and reseeding, and the ReplacingMergeTree key makes any re-run or API
// sync idempotent.
// Run: node --env-file=.env.development.local scripts/seed-clickhouse.mts <repo paths...>
import { execFileSync } from "node:child_process";
import { basename, resolve } from "node:path";
import { clickhouseAdmin } from "../lib/rendi/clickhouse.ts";

const repoPaths = process.argv.length > 2 ? process.argv.slice(2) : ["."];

type CommitRow = {
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

const commits: CommitRow[] = repoPaths.flatMap((path) => {
	const repo = basename(resolve(path));
	const log = execFileSync(
		"git",
		[
			"-C",
			path,
			"log",
			"--format=%x00%H%x1f%aI%x1f%aN%x1f%aE%x1f%P%x1f%s%x1f%b",
		],
		{ encoding: "utf8", maxBuffer: 1024 * 1024 * 1024 },
	);
	return log
		.split("\0")
		.filter(Boolean)
		.map((record) => {
			const [sha, iso, author, email, parents, subject, body] =
				record.split("\x1f");
			return {
				repo,
				sha,
				ts: Math.floor(Date.parse(iso) / 1000),
				author,
				author_email: email ?? "",
				subject: subject ?? "",
				body: (body ?? "").trim().slice(0, 2000),
				files_changed: 0,
				additions: 0,
				deletions: 0,
				is_merge: (parents ?? "").includes(" ") ? 1 : 0,
			};
		});
});

const readerPassword = process.env.CLICKHOUSE_READER_PASSWORD;
if (!readerPassword) {
	throw new Error("CLICKHOUSE_READER_PASSWORD is not set");
}
if (!/^[0-9a-zA-Z!_-]+$/.test(readerPassword)) {
	// The password is interpolated into DDL below (CREATE USER takes no query
	// params), so only a quote-free charset is accepted. Cloud's complexity
	// policy additionally wants an uppercase and a special character.
	throw new Error("CLICKHOUSE_READER_PASSWORD may only contain [0-9a-zA-Z!_-]");
}

const client = clickhouseAdmin();

await client.command({ query: "CREATE DATABASE IF NOT EXISTS git" });
await client.command({
	query: `CREATE TABLE IF NOT EXISTS git.commits (
		repo LowCardinality(String),
		sha String,
		ts DateTime('UTC'),
		author LowCardinality(String),
		author_email LowCardinality(String),
		subject String,
		body String,
		files_changed UInt32,
		additions UInt32,
		deletions UInt32,
		is_merge UInt8
	) ENGINE = ReplacingMergeTree ORDER BY (repo, ts, sha)`,
});
await client.command({
	query: `CREATE USER IF NOT EXISTS rendi_reader IDENTIFIED BY '${readerPassword}' SETTINGS readonly = 2`,
});
await client.command({ query: "GRANT SELECT ON git.* TO rendi_reader" });

const CHUNK = 20_000;
for (let i = 0; i < commits.length; i += CHUNK) {
	await client.insert({
		table: "git.commits",
		values: commits.slice(i, i + CHUNK),
		format: "JSONEachRow",
	});
}
await client.command({ query: "OPTIMIZE TABLE git.commits FINAL" });

const counted = await client.query({
	query:
		"SELECT repo, count() AS n FROM git.commits GROUP BY repo ORDER BY repo",
	format: "JSONEachRow",
});
console.log(await counted.json());
await client.close();
