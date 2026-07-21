import type { ClickHouseClient } from "@clickhouse/client";
import { describe, expect, it, vi } from "vitest";
import { executeInstrument, resolveQueryParams } from "./exec.ts";

const now = new Date("2026-07-19T12:00:00Z");

const spec = {
	sql: "SELECT toDate(ts) AS day, count() AS commits FROM git.commits WHERE ts >= {from:DateTime} AND ts < {to:DateTime} AND length(sha) > {minLen:UInt32} GROUP BY day",
	params: [
		{
			name: "from",
			type: "DateTime",
			control: "timerange" as const,
			defaultValue: "now-30d",
		},
		{
			name: "to",
			type: "DateTime",
			control: "timerange" as const,
			defaultValue: "now",
		},
		{
			name: "minLen",
			type: "UInt32",
			control: "number" as const,
			defaultValue: "0",
		},
	],
};

describe("resolveQueryParams", () => {
	it("resolves defaults by declared type, DateTime as whole epoch seconds", () => {
		const resolved = resolveQueryParams(spec, {}, now);
		expect(resolved.from).toBe(Date.parse("2026-06-19T12:00:00Z") / 1000);
		expect(resolved.to).toBe(Date.parse("2026-07-19T12:00:00Z") / 1000);
		expect(resolved.minLen).toBe(0);
	});

	it("lets steered values override defaults", () => {
		const resolved = resolveQueryParams(spec, { from: "now-7d" }, now);
		expect(resolved.from).toBe(Date.parse("2026-07-12T12:00:00Z") / 1000);
		expect(resolved.to).toBe(Date.parse("2026-07-19T12:00:00Z") / 1000);
	});

	it("rejects a placeholder the params never declare", () => {
		const drifted = { ...spec, params: spec.params.slice(0, 2) };
		expect(() => resolveQueryParams(drifted, {}, now)).toThrow(
			/does not declare/,
		);
	});

	it("rejects a declared param the SQL never uses", () => {
		const drifted = {
			...spec,
			sql: "SELECT count() FROM git.commits WHERE ts >= {from:DateTime} AND ts < {to:DateTime}",
		};
		expect(() => resolveQueryParams(drifted, {}, now)).toThrow(/never uses/);
	});

	it("rejects values for unknown params", () => {
		expect(() => resolveQueryParams(spec, { limit: "10" }, now)).toThrow(
			/unknown param "limit"/,
		);
	});

	it("rejects non-numeric values for numeric params", () => {
		expect(() =>
			resolveQueryParams(spec, { minLen: "ten; DROP TABLE" }, now),
		).toThrow(/expects a number/);
	});

	it("cross-checks placeholders whose types contain commas and quotes", () => {
		const exotic = {
			sql: "SELECT count() FROM t WHERE d >= {cutoff:DateTime('UTC')} AND amount > {floor:Decimal(18, 2)}",
			params: [
				{
					name: "cutoff",
					type: "DateTime",
					control: "timerange" as const,
					defaultValue: "now-1d",
				},
				{
					name: "floor",
					type: "Decimal(18, 2)",
					control: "number" as const,
					defaultValue: "0.5",
				},
			],
		};
		const resolved = resolveQueryParams(exotic, {}, now);
		expect(resolved.floor).toBe(0.5);
	});
});

describe("executeInstrument", () => {
	it("maps the JSON envelope to columns, rows, and server stats", async () => {
		const query = vi.fn().mockResolvedValue({
			json: async () => ({
				meta: [
					{ name: "day", type: "Date" },
					{ name: "commits", type: "UInt64" },
				],
				data: [{ day: "2026-07-01", commits: "42" }],
				rows: 1,
				statistics: { elapsed: 0.0071, rows_read: 12412, bytes_read: 1301234 },
			}),
		});
		const client = { query } as unknown as ClickHouseClient;

		const result = await executeInstrument(client, spec, {});

		expect(result.columns).toEqual([
			{ name: "day", type: "Date" },
			{ name: "commits", type: "UInt64" },
		]);
		expect(result.rows).toEqual([{ day: "2026-07-01", commits: "42" }]);
		expect(result.stats.serverElapsedMs).toBe(7);
		expect(result.stats.rowsRead).toBe(12412);
		expect(result.stats.bytesRead).toBe(1301234);
		expect(result.stats.elapsedMs).toBeGreaterThanOrEqual(0);

		const call = query.mock.calls[0][0];
		expect(call.format).toBe("JSON");
		expect(call.clickhouse_settings.max_result_rows).toBe("10000");
		expect(call.clickhouse_settings.max_result_bytes).toBe("52428800");
	});
});
