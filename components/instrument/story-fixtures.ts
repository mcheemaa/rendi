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

// A real tiny PNG so screenshot stories render genuine image bytes.
export const LOOK_PNG =
	"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";
