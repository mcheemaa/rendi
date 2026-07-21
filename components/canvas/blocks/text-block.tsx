"use client";

import { useEffect, useRef, useState } from "react";
import { Streamdown } from "streamdown";
import type { CanvasBlock } from "@/lib/rendi/canvas";
import { useCanvas } from "../canvas-context";

type TextBlock = Extract<CanvasBlock, { kind: "text" }>;

export function TextBlockBody({ block }: { block: TextBlock }) {
	const { store } = useCanvas();
	const host = useRef<HTMLDivElement>(null);
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(block.markdown);
	// The gesture layer cancels pointerdown defaults, which suppresses the
	// browser's dblclick synthesis, so double-press is detected explicitly.
	const lastDown = useRef(0);

	useEffect(() => {
		if (host.current) host.current.dataset.blockReady = "true";
	}, []);

	if (editing) {
		return (
			<textarea
				data-no-drag
				className="h-full w-full resize-none bg-transparent p-3 font-mono text-xs leading-relaxed outline-none"
				value={draft}
				// biome-ignore lint/a11y/noAutofocus: the editor opens from an explicit double press
				autoFocus
				onChange={(event) => setDraft(event.target.value)}
				onBlur={() => {
					setEditing(false);
					if (draft !== block.markdown) {
						store.dispatch(
							{ op: "set_content", id: block.id, markdown: draft },
							"user",
						);
					}
				}}
			/>
		);
	}

	return (
		<div
			ref={host}
			className="h-full overflow-auto px-3.5 py-3 text-sm leading-relaxed [&_p]:my-1.5 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-4"
			// Capture phase: the gesture layer stops propagation at the block,
			// so bubble-phase handlers below it never fire.
			onPointerDownCapture={(event) => {
				if (event.timeStamp - lastDown.current < 400) {
					setDraft(block.markdown);
					setEditing(true);
				}
				lastDown.current = event.timeStamp;
			}}
		>
			<Streamdown>{block.markdown}</Streamdown>
		</div>
	);
}
