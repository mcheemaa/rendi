import { describe, expect, it } from "vitest";
import {
	instrumentSpec,
	persistedInstrumentSpec,
	presentOf,
} from "./instrument.ts";

const base = { title: "Daily commits", sql: "SELECT 1" };
const chart = { type: "bar", xField: "day", yField: "commits" } as const;

describe("presentOf", () => {
	it("returns a declared present verbatim", () => {
		const spec = persistedInstrumentSpec.parse({
			...base,
			present: { kind: "chart", ...chart },
		});
		expect(presentOf(spec)).toEqual({ kind: "chart", ...chart });
	});

	it("normalizes a legacy chart payload to a chart present", () => {
		const spec = persistedInstrumentSpec.parse({ ...base, chart });
		expect(presentOf(spec)).toEqual({ kind: "chart", ...chart });
	});

	it("defaults to table when nothing is declared", () => {
		const spec = persistedInstrumentSpec.parse(base);
		expect(presentOf(spec)).toEqual({ kind: "table" });
	});
});

describe("spec validation", () => {
	it("rejects a select control without options", () => {
		const result = instrumentSpec.safeParse({
			...base,
			params: [
				{
					name: "grain",
					type: "String",
					control: "select",
					defaultValue: "daily",
				},
			],
		});
		expect(result.success).toBe(false);
	});

	it("accepts a select control with options", () => {
		const result = instrumentSpec.safeParse({
			...base,
			params: [
				{
					name: "grain",
					type: "String",
					control: "select",
					defaultValue: "daily",
					options: ["hourly", "daily", "weekly"],
				},
			],
		});
		expect(result.success).toBe(true);
	});

	// The downgrade trap: the clean tool schema strips unknown keys, so a
	// legacy payload parsed with it would silently lose its chart and render
	// as a table. Render surfaces must parse with persistedInstrumentSpec.
	it("keeps the legacy chart only through the persisted schema", () => {
		const legacy = { ...base, chart };
		const clean = instrumentSpec.parse(legacy);
		expect("chart" in clean).toBe(false);
		const persisted = persistedInstrumentSpec.parse(legacy);
		expect(persisted.chart).toEqual(chart);
	});
});
