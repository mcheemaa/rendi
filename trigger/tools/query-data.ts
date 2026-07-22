import { createHash } from "node:crypto";
import { tool } from "ai";
import { z } from "zod";
import { clickhouseReader } from "@/lib/rendi/clickhouse";
import { emitSpan, turnContext } from "@/lib/rendi/harness/telemetry";

const ROW_CAP = 500;

export const queryData = tool({
	description:
		"Run read-only ClickHouse SQL with your own eyes: DESCRIBE tables, sample rows, check ranges and distributions, test aggregations before building instruments. ClickHouse is strict: every selected column is either aggregated or in GROUP BY. Results return to you, not the user. Run as many queries as you need, in parallel when they are independent. At most 500 rows return per call; when truncated is true, page with LIMIT and OFFSET or aggregate for the rest.",
	inputSchema: z.object({
		sql: z
			.string()
			.describe("One read-only statement: SELECT, SHOW, DESCRIBE, or EXISTS."),
	}),
	execute: async ({ sql }, { toolCallId }) => {
		const started = performance.now();
		const turn = turnContext();
		const span = {
			conversationId: turn?.conversationId ?? "",
			turn: turn?.turn ?? 0,
			runId: turn?.runId,
			parentSpanId: turn?.spanId,
			spanKind: "query" as const,
			name: "query-data",
			input: sql,
			sqlHash: createHash("sha256").update(sql).digest("hex").slice(0, 16),
			toolCallId,
		};
		try {
			const result = await clickhouseReader().query({
				query: sql,
				format: "JSONEachRow",
				clickhouse_settings: {
					max_execution_time: 10,
					// Memory backstop only; the honest row cap is the slice below
					// (server-side row caps truncate at block granularity).
					max_result_bytes: "104857600",
				},
			});
			const fetched = await result.json<Record<string, unknown>>();
			const { rows, truncated } = capRows(fetched);
			const summary = readSummary(result.response_headers);
			const elapsedMs = Math.round(performance.now() - started);
			emitSpan({
				...span,
				output: { rowCount: rows.length, truncated },
				durationMs: elapsedMs,
				resultRows: rows.length,
				readRows: summary.readRows,
				readBytes: summary.readBytes,
			});
			return {
				rows,
				rowCount: rows.length,
				truncated,
				...(truncated
					? { hint: "capped at 500 rows; page with LIMIT/OFFSET or aggregate" }
					: {}),
				stats: {
					elapsedMs,
					readRows: summary.readRows,
					readBytes: summary.readBytes,
				},
			};
		} catch (error) {
			emitSpan({
				...span,
				status: "error",
				errorMessage: String(error),
				durationMs: performance.now() - started,
			});
			throw error;
		}
	},
});

export function capRows<T>(fetched: T[]): { rows: T[]; truncated: boolean } {
	const truncated = fetched.length > ROW_CAP;
	return { rows: truncated ? fetched.slice(0, ROW_CAP) : fetched, truncated };
}

export function readSummary(
	headers: Record<string, string | string[] | undefined>,
) {
	try {
		const raw = headers["x-clickhouse-summary"];
		const parsed = JSON.parse(Array.isArray(raw) ? raw[0] : (raw ?? "{}"));
		return {
			readRows: Number(parsed.read_rows ?? 0),
			readBytes: Number(parsed.read_bytes ?? 0),
		};
	} catch {
		return { readRows: 0, readBytes: 0 };
	}
}
