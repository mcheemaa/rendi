import { describe, expect, it } from "vitest";
import { resolveTimeValue } from "./relative-time.ts";

const now = new Date("2026-07-19T12:00:00Z");

describe("resolveTimeValue", () => {
	it("resolves now to the reference instant", () => {
		expect(resolveTimeValue("now", now).toISOString()).toBe(now.toISOString());
	});

	it("resolves each relative unit", () => {
		expect(resolveTimeValue("now-45m", now).toISOString()).toBe(
			"2026-07-19T11:15:00.000Z",
		);
		expect(resolveTimeValue("now-12h", now).toISOString()).toBe(
			"2026-07-19T00:00:00.000Z",
		);
		expect(resolveTimeValue("now-30d", now).toISOString()).toBe(
			"2026-06-19T12:00:00.000Z",
		);
		expect(resolveTimeValue("now-2w", now).toISOString()).toBe(
			"2026-07-05T12:00:00.000Z",
		);
	});

	it("accepts ISO 8601 absolutes", () => {
		expect(resolveTimeValue("2026-07-01T00:00:00Z", now).toISOString()).toBe(
			"2026-07-01T00:00:00.000Z",
		);
	});

	it("rejects SQL expressions with a pointed error", () => {
		expect(() => resolveTimeValue("now() - INTERVAL 30 DAY", now)).toThrow(
			/relative token/,
		);
	});
});
