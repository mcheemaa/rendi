import { createHash } from "node:crypto";
import { z } from "zod";
import { clickhouseReader } from "@/lib/rendi/clickhouse";
import { executeInstrument } from "@/lib/rendi/exec";
import { emitSpan } from "@/lib/rendi/harness/telemetry";
import { instrumentSpec } from "@/lib/rendi/instrument";

const execRequest = z.object({
	spec: instrumentSpec.pick({ sql: true, params: true }),
	values: z.record(z.string(), z.string()).default({}),
	context: z.object({
		conversationId: z.string(),
		instrumentId: z.string(),
	}),
});

// One pooled reader per process: steering must stay sub-second warm, and a
// per-request client would pay the TLS handshake on every steer.
let reader: ReturnType<typeof clickhouseReader> | undefined;

export async function POST(request: Request) {
	const body = await request.json().catch(() => null);
	const parsed = execRequest.safeParse(body);
	if (!parsed.success) {
		return Response.json({ error: "malformed exec request" }, { status: 400 });
	}
	const { spec, values, context } = parsed.data;
	const started = performance.now();
	// Steering runs with the model out of the loop: no run, no parent span.
	// The query span still lands under the conversation with the instrument
	// in attrs, which is exactly the no-model proof the demo leans on.
	const span = {
		conversationId: context.conversationId,
		turn: 0,
		spanKind: "query" as const,
		name: "instrument-exec",
		input: { sql: spec.sql, values },
		sqlHash: createHash("sha256").update(spec.sql).digest("hex").slice(0, 16),
		attrs: { instrument_id: context.instrumentId },
	};
	try {
		reader ??= clickhouseReader();
		const result = await executeInstrument(reader, spec, values);
		emitSpan({
			...span,
			output: { rowCount: result.rows.length },
			durationMs: result.stats.elapsedMs,
			resultRows: result.rows.length,
			readRows: result.stats.rowsRead,
			readBytes: result.stats.bytesRead,
		});
		return Response.json(result);
	} catch (error) {
		emitSpan({
			...span,
			status: "error",
			errorMessage: String(error),
			durationMs: performance.now() - started,
		});
		// In-band so the card renders execution errors the way query cards do.
		return Response.json({ error: String(error) });
	}
}
