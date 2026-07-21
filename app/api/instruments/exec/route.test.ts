import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InstrumentResult } from "@/lib/rendi/exec";

const execute = vi.hoisted(() => vi.fn());
const emitSpan = vi.hoisted(() => vi.fn());
const persistExecution = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@/lib/rendi/exec", () => ({ executeInstrument: execute }));
vi.mock("@/lib/rendi/harness/telemetry", () => ({ emitSpan }));
vi.mock("@/lib/rendi/harness/readback", () => ({ persistExecution }));
vi.mock("@/lib/rendi/clickhouse", () => ({ clickhouseReader: () => ({}) }));

import { POST } from "./route.ts";

const result: InstrumentResult = {
	columns: [{ name: "day", type: "Date" }],
	rows: [{ day: "2026-07-01" }],
	stats: { elapsedMs: 41, serverElapsedMs: 5, rowsRead: 7641, bytesRead: 91 },
};

function post(body: unknown) {
	return POST(
		new Request("http://rendi.local/api/instruments/exec", {
			method: "POST",
			body: JSON.stringify(body),
		}),
	);
}

const valid = {
	spec: {
		title: "Daily commits",
		sql: "SELECT toDate(ts) AS day FROM git.commits WHERE ts >= {from:DateTime}",
		params: [
			{
				name: "from",
				type: "DateTime",
				control: "timerange",
				defaultValue: "now-30d",
			},
		],
	},
	present: { kind: "chart", type: "bar", xField: "day", yField: "commits" },
	values: { from: "now-7d" },
	context: { conversationId: "conv-1", instrumentId: "inst-1", version: 2 },
};

beforeEach(() => {
	execute.mockReset();
	emitSpan.mockReset();
	persistExecution.mockClear();
	persistExecution.mockResolvedValue(undefined);
});

describe("POST /api/instruments/exec", () => {
	it("executes and returns the instrument result with a query span", async () => {
		execute.mockResolvedValue(result);
		const response = await post(valid);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual(result);
		expect(execute).toHaveBeenCalledWith(expect.anything(), valid.spec, {
			from: "now-7d",
		});

		const span = emitSpan.mock.calls[0][0];
		expect(span.spanKind).toBe("query");
		expect(span.name).toBe("instrument-exec");
		expect(span.conversationId).toBe("conv-1");
		expect(span.attrs).toEqual({ instrument_id: "inst-1", surface: "chat" });
		expect(span.sqlHash).toHaveLength(16);
		expect(span.readRows).toBe(7641);

		expect(persistExecution).toHaveBeenCalledWith({
			conversationId: "conv-1",
			instrumentId: "inst-1",
			title: "Daily commits",
			sqlText: valid.spec.sql,
			params: valid.spec.params,
			present: valid.present,
			version: 2,
			values: { from: "now-7d" },
			steer: undefined,
		});
	});

	it("captures a steer as an op alongside the execution", async () => {
		execute.mockResolvedValue(result);
		const response = await post({
			...valid,
			steer: { param: "from", old: "now-30d", new: "now-7d" },
		});

		expect(response.status).toBe(200);
		expect(persistExecution.mock.calls[0][0].steer).toEqual({
			param: "from",
			old: "now-30d",
			new: "now-7d",
		});
	});

	it("records the steer even when the query fails, and readback failures never fail an execution", async () => {
		execute.mockRejectedValue(new Error("boom"));
		persistExecution.mockRejectedValue(new Error("neon down"));
		const response = await post({
			...valid,
			steer: { param: "from", old: "now-30d", new: "now-7d" },
		});

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ error: "Error: boom" });
		expect(persistExecution).toHaveBeenCalledOnce();
	});

	it("returns ClickHouse errors in-band with an error span", async () => {
		execute.mockRejectedValue(new Error("Not enough privileges"));
		const response = await post(valid);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			error: "Error: Not enough privileges",
		});
		expect(emitSpan.mock.calls[0][0].status).toBe("error");
	});

	it("rejects a malformed request without executing", async () => {
		const response = await post({ spec: { sql: 1 } });

		expect(response.status).toBe(400);
		expect(execute).not.toHaveBeenCalled();
		expect(emitSpan).not.toHaveBeenCalled();
	});

	it("never writes chat readback for canvas-surface executions", async () => {
		execute.mockResolvedValue(result);
		const response = await post({
			...valid,
			context: { ...valid.context, surface: "canvas" },
		});

		expect(response.status).toBe(200);
		expect(persistExecution).not.toHaveBeenCalled();
		expect(emitSpan.mock.calls[0][0].attrs).toEqual({
			instrument_id: "inst-1",
			surface: "canvas",
		});
	});

	it("rejects a select param that lost its options", async () => {
		const response = await post({
			...valid,
			spec: {
				sql: "SELECT 1 WHERE g = {grain:String}",
				params: [
					{
						name: "grain",
						type: "String",
						control: "select",
						defaultValue: "daily",
					},
				],
			},
		});
		expect(response.status).toBe(400);
		expect(execute).not.toHaveBeenCalled();
	});
});
