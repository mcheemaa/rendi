import { describe, expect, it } from "vitest";
import { capRows, readSummary } from "./query-data.ts";

describe("capRows", () => {
	it("passes through at exactly the cap without claiming truncation", () => {
		const { rows, truncated } = capRows(
			Array.from({ length: 500 }, (_, i) => i),
		);
		expect(rows).toHaveLength(500);
		expect(truncated).toBe(false);
	});

	it("slices one past the cap and says so", () => {
		const { rows, truncated } = capRows(
			Array.from({ length: 501 }, (_, i) => i),
		);
		expect(rows).toHaveLength(500);
		expect(rows[499]).toBe(499);
		expect(truncated).toBe(true);
	});

	it("handles a block-granular flood far past the cap", () => {
		const { rows, truncated } = capRows(new Array(7641).fill({ sha: "x" }));
		expect(rows).toHaveLength(500);
		expect(truncated).toBe(true);
	});
});

describe("readSummary", () => {
	it("parses the ClickHouse summary header", () => {
		expect(
			readSummary({
				"x-clickhouse-summary": '{"read_rows":"7641","read_bytes":"1301234"}',
			}),
		).toEqual({ readRows: 7641, readBytes: 1301234 });
	});

	it("takes the first value of a repeated header", () => {
		expect(
			readSummary({
				"x-clickhouse-summary": ['{"read_rows":"2","read_bytes":"34"}', "{}"],
			}),
		).toEqual({ readRows: 2, readBytes: 34 });
	});

	it("returns zeros for a missing or hostile header", () => {
		expect(readSummary({})).toEqual({ readRows: 0, readBytes: 0 });
		expect(readSummary({ "x-clickhouse-summary": "not json" })).toEqual({
			readRows: 0,
			readBytes: 0,
		});
	});
});
