import { describe, expect, it } from "vitest";
import { resolveQueryParams } from "./exec.ts";

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
