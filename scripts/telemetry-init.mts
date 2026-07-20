// Provisions the LLM observability sink. Idempotent, converges existing
// tables. Run: node --env-file=.env.development.local scripts/telemetry-init.mts
import { createClient } from "@clickhouse/client";
import { clickhouseAdmin } from "../lib/rendi/clickhouse.ts";
import { PRICE_SCHEDULES } from "../lib/rendi/harness/pricing.ts";

const writerPassword = process.env.CLICKHOUSE_TELEMETRY_PASSWORD;
if (!writerPassword) {
	throw new Error("CLICKHOUSE_TELEMETRY_PASSWORD is not set");
}

// Cost convention: llm spans carry the truth; agent spans aggregate
// their children, so spend rollups sum WHERE span_kind = 'llm', never
// all kinds. model_prices is ReplacingMergeTree: read with FINAL or
// argMax after re-provisioning.
const SPANS_DDL = `
CREATE TABLE IF NOT EXISTS rendi_telemetry.spans (
	ts DateTime64(3, 'UTC'),
	conversation_id String,
	turn UInt32,
	run_id String DEFAULT '',
	span_id String,
	parent_span_id String DEFAULT '',
	span_kind LowCardinality(String),
	name String,
	model LowCardinality(String) DEFAULT '',
	status LowCardinality(String) DEFAULT 'ok',
	error_message String DEFAULT '',
	duration_ms UInt32 DEFAULT 0,
	input String DEFAULT '',
	output String DEFAULT '',
	input_tokens UInt64 DEFAULT 0,
	output_tokens UInt64 DEFAULT 0,
	total_tokens UInt64 DEFAULT 0,
	reasoning_output_tokens UInt64 DEFAULT 0,
	cache_read_input_tokens UInt64 DEFAULT 0,
	cache_write_input_tokens UInt64 DEFAULT 0,
	cost_usd Float64 DEFAULT 0,
	cost_known UInt8 DEFAULT 0,
	time_to_first_token_ms UInt32 DEFAULT 0,
	finish_reason LowCardinality(String) DEFAULT '',
	stopped UInt8 DEFAULT 0,
	continuation UInt8 DEFAULT 0,
	tool_call_id String DEFAULT '',
	sql_hash String DEFAULT '',
	result_rows UInt64 DEFAULT 0,
	read_rows UInt64 DEFAULT 0,
	read_bytes UInt64 DEFAULT 0,
	attrs String DEFAULT '{}'
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(ts)
ORDER BY (conversation_id, turn, ts)
`;

const admin = clickhouseAdmin();

async function command(query: string) {
	await admin.command({ query });
}

const PRICES_DDL = `
CREATE TABLE IF NOT EXISTS rendi_telemetry.model_prices (
	model LowCardinality(String),
	valid_from Date,
	input_usd_mtok Float64,
	output_usd_mtok Float64,
	cache_read_usd_mtok Float64,
	cache_write_5m_usd_mtok Float64,
	cache_write_1h_usd_mtok Float64
)
ENGINE = ReplacingMergeTree
ORDER BY (model, valid_from)
`;

await command("CREATE DATABASE IF NOT EXISTS rendi_telemetry");
await command(SPANS_DDL);
await command(PRICES_DDL);
await command(
	`CREATE USER IF NOT EXISTS rendi_telemetry_writer IDENTIFIED BY '${writerPassword}'`,
);
await command(
	"GRANT INSERT ON rendi_telemetry.spans TO rendi_telemetry_writer",
);
await command("GRANT SELECT ON rendi_telemetry.* TO rendi_reader");

const priceRows = Object.entries(PRICE_SCHEDULES).flatMap(
	([model, schedules]) =>
		schedules.map(({ validFrom, card }) => ({
			model,
			valid_from: validFrom,
			input_usd_mtok: card.input,
			output_usd_mtok: card.output,
			cache_read_usd_mtok: card.cacheRead,
			cache_write_5m_usd_mtok: card.cacheWrite5m,
			cache_write_1h_usd_mtok: card.cacheWrite1h,
		})),
);
await admin.insert({
	table: "rendi_telemetry.model_prices",
	format: "JSONEachRow",
	values: priceRows,
});
console.log(`model_prices: ${priceRows.length} rows upserted`);

const writer = createClient({
	url: process.env.CLICKHOUSE_URL,
	username: "rendi_telemetry_writer",
	password: writerPassword,
	database: "rendi_telemetry",
});

// The writer must insert and must not read: both directions proven, not assumed.
await writer.insert({
	table: "spans",
	format: "JSONEachRow",
	values: [
		{
			ts: new Date().toISOString(),
			conversation_id: "provision-probe",
			turn: 0,
			span_id: crypto.randomUUID(),
			span_kind: "agent",
			name: "provision-probe",
		},
	],
	clickhouse_settings: { date_time_input_format: "best_effort" },
});
console.log("writer INSERT: ok");

let selectRefused = false;
try {
	await writer.query({ query: "SELECT count() FROM rendi_telemetry.spans" });
} catch {
	selectRefused = true;
}
console.log(`writer SELECT refused: ${selectRefused ? "ok" : "FAIL"}`);

const reader = createClient({
	url: process.env.CLICKHOUSE_URL,
	username: "rendi_reader",
	password: process.env.CLICKHOUSE_READER_PASSWORD,
});
const probe = await reader.query({
	query:
		"SELECT count() AS n FROM rendi_telemetry.spans WHERE conversation_id = 'provision-probe'",
	format: "JSONEachRow",
});
const rows = await probe.json<{ n: string }>();
console.log(
	`reader sees probe span: ${Number(rows[0]?.n) >= 1 ? "ok" : "FAIL"}`,
);

await Promise.all([admin.close(), writer.close(), reader.close()]);
if (!selectRefused) process.exit(1);
