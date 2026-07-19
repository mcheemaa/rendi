import { execFileSync } from "node:child_process";
import { basename, resolve } from "node:path";
import { clickhouseAdmin } from "../lib/rendi/clickhouse.ts";

const repoPaths = process.argv.length > 2 ? process.argv.slice(2) : ["."];

type CommitRow = {
	repo: string;
	sha: string;
	ts: number;
	author: string;
	subject: string;
};

const commits: CommitRow[] = repoPaths.flatMap((path) => {
	const repo = basename(resolve(path));
	const log = execFileSync(
		"git",
		["-C", path, "log", "--format=%H%x09%aI%x09%aN%x09%s"],
		{ encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
	);
	return log
		.split("\n")
		.filter(Boolean)
		.map((line) => {
			const [sha, iso, author, subject = ""] = line.split("\t");
			return {
				repo,
				sha,
				ts: Math.floor(Date.parse(iso) / 1000),
				author,
				subject,
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
		subject String
	) ENGINE = ReplacingMergeTree ORDER BY (repo, ts, sha)`,
});
await client.command({
	query: `CREATE USER IF NOT EXISTS rendi_reader IDENTIFIED BY '${readerPassword}' SETTINGS readonly = 2`,
});
await client.command({ query: "GRANT SELECT ON git.* TO rendi_reader" });

await client.insert({
	table: "git.commits",
	values: commits,
	format: "JSONEachRow",
});
await client.command({ query: "OPTIMIZE TABLE git.commits FINAL" });

const counted = await client.query({
	query:
		"SELECT repo, count() AS n FROM git.commits GROUP BY repo ORDER BY repo",
	format: "JSONEachRow",
});
console.log(await counted.json());
await client.close();
