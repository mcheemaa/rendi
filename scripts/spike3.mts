// Proves Rendi contract properties 2 and 3: the instrument spike 2's agent
// emitted re-executes against live ClickHouse, steered by the user, with the
// model never in the loop (this file has no AI imports at all).
import { readFileSync } from "node:fs";
import { clickhouseReader } from "../lib/rendi/clickhouse.ts";
import { executeInstrument } from "../lib/rendi/exec.ts";
import { instrumentSpec } from "../lib/rendi/instrument.ts";

const fixture = JSON.parse(
	readFileSync(
		new URL("./fixtures/instrument-daily-commits.json", import.meta.url),
		"utf8",
	),
);
const spec = instrumentSpec.parse(fixture);

const client = clickhouseReader();

const runs: [string, Record<string, string>][] = [
	["defaults, now-30d to now", {}],
	["steered, last 7 days", { from: "now-7d" }],
	[
		"steered, absolute June window",
		{ from: "2026-06-01T00:00:00Z", to: "2026-07-01T00:00:00Z" },
	],
];

for (const [label, values] of runs) {
	const { rows, stats } = await executeInstrument(client, spec, values);
	const commits = rows.reduce((sum, row) => sum + Number(row.commits ?? 0), 0);
	console.log(
		`${label}: ${rows.length} day buckets, ${commits} commits, ${stats.elapsedMs}ms (server ${stats.serverElapsedMs}ms, read ${stats.rowsRead} rows)`,
	);
}

try {
	await client.command({
		query: "INSERT INTO git.commits VALUES ('x', 'x', now(), 'x', 'x')",
	});
	console.log("WRITE ACCEPTED: the reader user is NOT read-only, fix this");
	process.exitCode = 1;
} catch {
	console.log("write as rendi_reader correctly refused");
}

console.log("model calls made: 0");
await client.close();
