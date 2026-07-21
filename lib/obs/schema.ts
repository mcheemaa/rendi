// Cost convention: llm spans carry the truth; agent spans aggregate
// their children, so spend rollups sum WHERE span_kind = 'llm', never
// all kinds. model_prices is ReplacingMergeTree: read with FINAL or
// argMax after re-provisioning.
export function spansDdl(database: string): string {
	return `
CREATE TABLE IF NOT EXISTS ${database}.spans (
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
}

export function pricesDdl(database: string): string {
	return `
CREATE TABLE IF NOT EXISTS ${database}.model_prices (
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
}
