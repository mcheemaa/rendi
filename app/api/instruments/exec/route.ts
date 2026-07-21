import { createHash } from "node:crypto";
import { z } from "zod";
import { clickhouseReader } from "@/lib/rendi/clickhouse";
import { executeInstrument } from "@/lib/rendi/exec";
import { persistExecution } from "@/lib/rendi/harness/readback";
import { emitSpan } from "@/lib/rendi/harness/telemetry";
import { instrumentSpec, present } from "@/lib/rendi/instrument";

const execRequest = z.object({
	spec: instrumentSpec.pick({ title: true, sql: true, params: true }),
	present: present.optional(),
	values: z.record(z.string(), z.string()).default({}),
	context: z.object({
		conversationId: z.string(),
		instrumentId: z.string(),
		version: z.number().int().positive().default(1),
	}),
	steer: z
		.object({ param: z.string(), old: z.string(), new: z.string() })
		.optional(),
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
	const { spec, values, context, steer } = parsed.data;
	const started = performance.now();
	// Readback rides in parallel with the query and can never fail it: the
	// instrument row tracks what the user sees, a steer appends to the op log.
	const recorded = persistExecution({
		conversationId: context.conversationId,
		instrumentId: context.instrumentId,
		title: spec.title,
		sqlText: spec.sql,
		params: spec.params,
		present: parsed.data.present,
		version: context.version,
		values,
		steer,
	}).catch((error) => console.error("[readback] persist failed", error));
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
		await recorded;
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
		// The steer still happened even when the query failed; the user is
		// looking at the error with the steered values applied.
		await recorded;
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
