"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { InstrumentResult } from "@/lib/rendi/exec";
import { type Instrument, presentOf } from "@/lib/rendi/instrument";

type Steer = { param: string; old: string; new: string };

export type InstrumentState = {
	values: Record<string, string>;
	result: InstrumentResult | null;
	error: string | null;
	running: boolean;
	steer: (name: string, value: string) => void;
};

// The one stateful layer between a persisted spec and its views: owns param
// values, executes through the exec route, and exposes steer(), the single
// seam where the readback slice will emit its op (actor, param, old, new).
export function useInstrument(
	instrument: Instrument,
	conversationId: string,
	surface: "chat" | "observability" = "chat",
): InstrumentState {
	const [values, setValues] = useState<Record<string, string>>({});
	const [result, setResult] = useState<InstrumentResult | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [running, setRunning] = useState(false);
	// Rapid steering races responses; only the newest request may land.
	const requestSeq = useRef(0);
	// Mirror of values: steer must read-modify-write outside the state
	// updater, where a side effect would double-fire under StrictMode.
	const valuesRef = useRef(values);
	// The instrument arrives re-parsed with fresh identity on every transcript
	// render; reading it through a ref keeps execute stable so streaming
	// re-renders can never fan out into a refetch storm.
	const instrumentRef = useRef(instrument);
	instrumentRef.current = instrument;

	const execute = useCallback(
		async (nextValues: Record<string, string>, steer?: Steer) => {
			const current = instrumentRef.current;
			const seq = ++requestSeq.current;
			setRunning(true);
			try {
				const response = await fetch("/api/instruments/exec", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						spec: {
							title: current.title,
							sql: current.sql,
							params: current.params,
						},
						present: presentOf(current),
						values: nextValues,
						context: {
							conversationId,
							instrumentId: current.id,
							version: current.version,
							surface,
						},
						...(steer ? { steer } : {}),
					}),
				});
				const body = (await response.json()) as
					| InstrumentResult
					| { error: string };
				if (seq !== requestSeq.current) return;
				if ("error" in body) {
					setError(body.error);
				} else {
					setError(null);
					setResult(body);
				}
			} catch (caught) {
				if (seq === requestSeq.current) setError(String(caught));
			} finally {
				if (seq === requestSeq.current) setRunning(false);
			}
		},
		[conversationId, surface],
	);

	// Property 2: a persisted instrument comes alive the moment it renders,
	// from its declared defaults.
	useEffect(() => {
		const defaults = Object.fromEntries(
			instrumentRef.current.params.map((param) => [
				param.name,
				param.defaultValue,
			]),
		);
		valuesRef.current = defaults;
		setValues(defaults);
		execute(defaults);
	}, [execute]);

	const steer = useCallback(
		(name: string, value: string) => {
			// The op the agent reads next turn: property 4 starts here.
			const old = valuesRef.current[name] ?? "";
			const next = { ...valuesRef.current, [name]: value };
			valuesRef.current = next;
			setValues(next);
			execute(next, { param: name, old, new: value });
		},
		[execute],
	);

	return { values, result, error, running, steer };
}
