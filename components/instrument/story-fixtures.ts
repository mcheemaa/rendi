import type { InstrumentResult } from "@/lib/rendi/exec";

// Story-only exec stand-in: stories exercise the real fetch path of
// useInstrument against deterministic fixtures, pass-through for everything
// else. Values mirror ClickHouse's JSON format, 64-bit integers quoted.
const AUTHORS: [string, number][] = [
	["Matt Aitken", 2479],
	["Eric Allam", 2279],
	["James Ritchie", 1160],
	["nicktrn", 964],
	["Dan Patel", 742],
	["samejr", 615],
	["D.K.", 512],
	["Trigger.dev Bot", 430],
	["Rita Gorokhod", 388],
	["Federico Fan", 301],
];

const TABLES = [
	["default", "git_commits"],
	["default", "nyc_taxi"],
	["rendi_telemetry", "spans"],
	["rendi_telemetry", "model_prices"],
];

function respond(body: {
	spec?: { sql?: string };
	values?: Record<string, string>;
}): InstrumentResult | { error: string } {
	const sql = body.spec?.sql ?? "";
	if (sql.includes("boom")) {
		return {
			error:
				"Code: 47. DB::Exception: Unknown identifier 'boom' in scope SELECT boom FROM git.commits.",
		};
	}
	if (sql.includes("label")) {
		return {
			columns: [
				{ name: "label", type: "String" },
				{ name: "prs", type: "UInt64" },
			],
			rows: [
				{ label: "bug", prs: "428" },
				{ label: "feature", prs: "316" },
				{ label: "docs", prs: "194" },
				{ label: "chore", prs: "132" },
				{ label: "refactor", prs: "96" },
				{ label: "test", prs: "71" },
				{ label: "ci", prs: "38" },
			],
			stats: {
				elapsedMs: 11,
				serverElapsedMs: 4,
				rowsRead: 84120,
				bytesRead: 2417800,
			},
		};
	}
	if (sql.includes("system.tables")) {
		return {
			columns: [
				{ name: "database", type: "String" },
				{ name: "name", type: "String" },
			],
			rows: TABLES.map(([database, name]) => ({ database, name })),
			stats: {
				elapsedMs: 12,
				serverElapsedMs: 3,
				rowsRead: 48,
				bytesRead: 4096,
			},
		};
	}
	const limit = Number(body.values?.top_n ?? "3");
	return {
		columns: [
			{ name: "author", type: "String" },
			{ name: "commits", type: "UInt64" },
		],
		rows: AUTHORS.slice(0, limit).map(([author, commits]) => ({
			author,
			commits: String(commits),
		})),
		stats: {
			elapsedMs: 41,
			serverElapsedMs: 5,
			rowsRead: 7641,
			bytesRead: 130123,
		},
	};
}

// The runner can restore window.fetch between module evaluation and story
// mount, so installation is identity-guarded and re-run from a decorator at
// every mount.
export function installExecMock(): void {
	const marker = window as Window & { __rendiExecFetch?: typeof fetch };
	if (window.fetch === marker.__rendiExecFetch) return;
	const real = window.fetch.bind(window);
	const patched: typeof fetch = async (input, init) => {
		const url =
			typeof input === "string"
				? input
				: input instanceof URL
					? input.href
					: input.url;
		if (!url.endsWith("/api/instruments/exec")) return real(input, init);
		const body = JSON.parse(String(init?.body ?? "{}"));
		return Response.json(respond(body));
	};
	marker.__rendiExecFetch = patched;
	window.fetch = patched;
}
