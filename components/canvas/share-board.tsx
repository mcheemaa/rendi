"use client";

import { useEffect, useRef } from "react";
import { type CanvasDoc, emptyCanvas } from "@/lib/rendi/canvas";
import { Board } from "./board";
import { createCameraStore } from "./camera";
import { type CanvasContextValue, CanvasProvider } from "./canvas-context";
import { createCanvasStore } from "./canvas-store";

// A shared board is live to look at and steer, never to alter: the sink is
// a no-op, so steering re-executes queries locally and nothing a viewer
// does ever reaches the owner's document.
export function ShareBoard({
	conversationId,
	initialDoc,
}: {
	conversationId: string;
	initialDoc: CanvasDoc | null;
}) {
	const valueRef = useRef<CanvasContextValue | null>(null);
	if (!valueRef.current) {
		valueRef.current = {
			store: createCanvasStore(
				initialDoc ?? emptyCanvas(conversationId, "Canvas"),
				() => {},
			),
			camera: createCameraStore(),
			conversationId,
			readOnly: true,
		};
	}
	const { store } = valueRef.current;

	useEffect(() => {
		const timer = setInterval(async () => {
			try {
				const response = await fetch(`/api/canvas/${conversationId}/ops`);
				const canvas = (await response.json()) as {
					doc: CanvasDoc;
					version: number;
				} | null;
				if (canvas && canvas.version > store.getState().doc.version) {
					store.adopt(canvas.doc);
				}
			} catch {
				// The next tick retries.
			}
		}, 5000);
		return () => clearInterval(timer);
	}, [conversationId, store]);

	return (
		<CanvasProvider value={valueRef.current}>
			<Board />
		</CanvasProvider>
	);
}
