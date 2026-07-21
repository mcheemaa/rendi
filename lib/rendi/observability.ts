import type { Instrument } from "./instrument";

// The observability surface is made of the same instruments the agent
// builds: preloaded specs over the telemetry database, steerable without
// the model, executed through the guarded exec path.

const WINDOW = {
	name: "window",
	type: "UInt32",
	control: "select" as const,
	defaultValue: "7",
	options: ["1", "7", "30", "90"],
};

export const OBSERVABILITY_CONVERSATION = "observability";

export const observabilityInstruments: Instrument[] = [
	{
		id: "obs-overview",
		version: 1,
		title: "Last days at a glance",
		sql: `
SELECT 'spend ($)' AS metric, round(sum(cost_usd), 2) AS value
FROM rendi_telemetry.spans
WHERE span_kind != 'agent' AND cost_known = 1 AND ts > now() - INTERVAL {window:UInt32} DAY
UNION ALL
SELECT 'tokens', sum(total_tokens)
FROM rendi_telemetry.spans
WHERE span_kind = 'llm' AND ts > now() - INTERVAL {window:UInt32} DAY
UNION ALL
SELECT 'sessions', uniqExact(conversation_id)
FROM rendi_telemetry.spans
WHERE span_kind = 'agent' AND ts > now() - INTERVAL {window:UInt32} DAY
UNION ALL
SELECT 'tool calls', countIf(span_kind = 'tool')
FROM rendi_telemetry.spans
WHERE ts > now() - INTERVAL {window:UInt32} DAY`,
		params: [WINDOW],
		present: { kind: "stat", valueField: "value", labelField: "metric" },
	},
	{
		id: "obs-cost-by-day",
		version: 1,
		title: "Spend by model",
		sql: `
SELECT toDate(ts) AS day, model, round(sum(cost_usd), 4) AS usd
FROM rendi_telemetry.spans
WHERE span_kind != 'agent' AND cost_known = 1
	AND ts > now() - INTERVAL {window:UInt32} DAY
GROUP BY day, model
ORDER BY day`,
		params: [WINDOW],
		present: {
			kind: "chart",
			type: "bar",
			xField: "day",
			yField: "usd",
			seriesField: "model",
		},
	},
	{
		id: "obs-ttft",
		version: 1,
		title: "Time to first token",
		sql: `
SELECT toDate(ts) AS day,
	round(avg(time_to_first_token_ms)) AS avg_ms,
	round(quantile(0.95)(time_to_first_token_ms)) AS p95_ms
FROM rendi_telemetry.spans
WHERE span_kind = 'agent' AND time_to_first_token_ms > 0
	AND ts > now() - INTERVAL {window:UInt32} DAY
GROUP BY day
ORDER BY day`,
		params: [WINDOW],
		present: {
			kind: "chart",
			type: "line",
			xField: "day",
			yField: ["avg_ms", "p95_ms"],
		},
	},
	{
		id: "obs-tools",
		version: 1,
		title: "Tools",
		sql: `
SELECT name AS tool,
	count() AS calls,
	round(countIf(status = 'error') / count() * 100, 1) AS error_pct,
	round(quantile(0.95)(duration_ms)) AS p95_ms,
	round(avg(duration_ms)) AS avg_ms
FROM rendi_telemetry.spans
WHERE span_kind = 'tool' AND ts > now() - INTERVAL {window:UInt32} DAY
GROUP BY name
ORDER BY calls DESC`,
		params: [WINDOW],
		present: { kind: "table" },
	},
	{
		id: "obs-sessions",
		version: 1,
		title: "Sessions",
		sql: `
SELECT conversation_id,
	max(turn) + 1 AS turns,
	countIf(span_kind = 'llm') AS generations,
	countIf(span_kind = 'tool') AS tool_calls,
	sum(total_tokens) AS tokens,
	round(sum(cost_usd), 4) AS cost_usd,
	max(ts) AS last_active
FROM rendi_telemetry.spans
WHERE ts > now() - INTERVAL {window:UInt32} DAY
GROUP BY conversation_id
ORDER BY last_active DESC
LIMIT {top:UInt32}`,
		params: [
			WINDOW,
			{
				name: "top",
				type: "UInt32",
				control: "select" as const,
				defaultValue: "15",
				options: ["15", "50", "100"],
			},
		],
		present: { kind: "table" },
	},
];
