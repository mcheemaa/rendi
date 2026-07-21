"use client";

import { useEffect, useRef, useState } from "react";
import type { CanvasBlock } from "@/lib/rendi/canvas";
import type { InstrumentResult } from "@/lib/rendi/exec";
import { presentOf } from "@/lib/rendi/instrument";

export type InstrumentBlock = Extract<CanvasBlock, { kind: "instrument" }>;

// The canvas twin of useInstrument: values come from the document
// (block.paramState), so steering flows dispatch -> reducer -> new props ->
// re-execution, and the exec route is told the surface so chat readback
// never double-writes.
export function useCanvasInstrument(
	block: InstrumentBlock,
	conversationId: string,
) {
	const [result, setResult] = useState<InstrumentResult | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [running, setRunning] = useState(false);
	const requestSeq = useRef(0);
	const blockRef = useRef(block);
	blockRef.current = block;

	const valuesKey = JSON.stringify(block.paramState);
	// The spec itself can change under a mounted block: the agent repairing
	// its own SQL after a look must re-execute here, not only on steering.
	const specKey = JSON.stringify(block.instrument);

	useEffect(() => {
		const { id } = blockRef.current;
		const instrument = JSON.parse(specKey) as InstrumentBlock["instrument"];
		const values = JSON.parse(valuesKey) as Record<string, string>;
		const seq = ++requestSeq.current;
		let cancelled = false;
		setRunning(true);
		(async () => {
			try {
				const response = await fetch("/api/instruments/exec", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						spec: {
							title: instrument.title,
							sql: instrument.sql,
							params: instrument.params,
						},
						present: presentOf(instrument),
						values,
						context: {
							conversationId,
							instrumentId: id,
							surface: "canvas",
						},
					}),
				});
				const body = (await response.json()) as
					| InstrumentResult
					| { error: string };
				if (cancelled || seq !== requestSeq.current) return;
				if ("error" in body) {
					setError(body.error);
				} else {
					setError(null);
					setResult(body);
				}
			} catch (caught) {
				if (!cancelled && seq === requestSeq.current) setError(String(caught));
			} finally {
				if (!cancelled && seq === requestSeq.current) setRunning(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [conversationId, valuesKey, specKey]);

	return { result, error, running };
}
