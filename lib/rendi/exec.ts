import type { ClickHouseClient } from "@clickhouse/client";
import type { InstrumentSpec } from "./instrument.ts";
import { resolveTimeValue } from "./relative-time.ts";

type ParamSpec = InstrumentSpec["params"][number];
type ExecutableSpec = Pick<InstrumentSpec, "sql" | "params">;

// Matches ClickHouse's native {name:Type} placeholder syntax. Only the name
// matters here (the server is the real parser of the type); matching anything
// up to the brace keeps exotic types like Decimal(18, 2) from false-failing
// the cross-check.
const PLACEHOLDER_PATTERN = /\{(\w+):[^}]+\}/g;

export function resolveQueryParams(
	spec: ExecutableSpec,
	values: Record<string, string>,
	now = new Date(),
): Record<string, unknown> {
	const declared = new Map(spec.params.map((param) => [param.name, param]));
	const placeholders = new Set(
		[...spec.sql.matchAll(PLACEHOLDER_PATTERN)].map((match) => match[1]),
	);

	for (const name of placeholders) {
		if (!declared.has(name)) {
			throw new Error(
				`SQL references {${name}:...} but params does not declare it`,
			);
		}
	}
	for (const name of declared.keys()) {
		if (!placeholders.has(name)) {
			throw new Error(`Param "${name}" is declared but the SQL never uses it`);
		}
	}
	for (const name of Object.keys(values)) {
		if (!declared.has(name)) {
			throw new Error(`Value given for unknown param "${name}"`);
		}
	}

	const resolved: Record<string, unknown> = {};
	for (const param of declared.values()) {
		resolved[param.name] = resolveValue(
			param,
			values[param.name] ?? param.defaultValue,
			now,
		);
	}
	return resolved;
}

function resolveValue(param: ParamSpec, raw: string, now: Date): unknown {
	// clickhouse-js serializes a JS Date as epoch-with-millis, which the server
	// rejects for plain DateTime params, so bind whole seconds ourselves.
	if (param.type.startsWith("DateTime64")) {
		return resolveTimeValue(raw, now);
	}
	if (param.type.startsWith("DateTime")) {
		return Math.floor(resolveTimeValue(raw, now).getTime() / 1000);
	}
	if (param.type === "Date") {
		return resolveTimeValue(raw, now).toISOString().slice(0, 10);
	}
	if (/^(U?Int|Float|Decimal)/.test(param.type)) {
		const numeric = Number(raw);
		if (Number.isNaN(numeric)) {
			throw new Error(`Param "${param.name}" expects a number, got "${raw}"`);
		}
		return numeric;
	}
	return raw;
}

export async function executeInstrument(
	client: ClickHouseClient,
	spec: ExecutableSpec,
	values: Record<string, string> = {},
): Promise<{ rows: Record<string, unknown>[]; elapsedMs: number }> {
	const started = performance.now();
	const result = await client.query({
		query: spec.sql,
		query_params: resolveQueryParams(spec, values),
		format: "JSONEachRow",
		// Belt over the reader user's grants: hard caps hold even if a
		// generated query is pathological.
		clickhouse_settings: {
			max_execution_time: 10,
			max_result_rows: "10000",
		},
	});
	const rows = await result.json<Record<string, unknown>>();
	return { rows, elapsedMs: Math.round(performance.now() - started) };
}
