"use client";

import { useRef } from "react";
import type { CanvasBlock } from "@/lib/rendi/canvas";
import { cn } from "@/lib/utils";
import { HtmlBlockBody } from "./blocks/html-block";
import { ImageBlockBody } from "./blocks/image-block";
import { InstrumentBlockBody } from "./blocks/instrument-block";
import { TextBlockBody } from "./blocks/text-block";
import { useCanvas } from "./canvas-context";
import { useCanvasStore } from "./canvas-store";
import { type ResizeDir, useBlockGestures } from "./use-gestures";

const HANDLES: ResizeDir[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

const HANDLE_CLASS: Record<ResizeDir, string> = {
	n: "-top-1 left-1/2 -translate-x-1/2 cursor-ns-resize",
	s: "-bottom-1 left-1/2 -translate-x-1/2 cursor-ns-resize",
	e: "top-1/2 -right-1 -translate-y-1/2 cursor-ew-resize",
	w: "top-1/2 -left-1 -translate-y-1/2 cursor-ew-resize",
	ne: "-top-1 -right-1 cursor-nesw-resize",
	nw: "-top-1 -left-1 cursor-nwse-resize",
	se: "-bottom-1 -right-1 cursor-nwse-resize",
	sw: "-bottom-1 -left-1 cursor-nesw-resize",
};

const KIND_LABEL: Record<CanvasBlock["kind"], string> = {
	instrument: "instrument",
	text: "note",
	image: "image",
	html: "agent html",
};

function isTypingTarget(target: EventTarget | null): boolean {
	return (
		target instanceof HTMLElement &&
		(target.isContentEditable ||
			["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
	);
}

export function BlockView({ block }: { block: CanvasBlock }) {
	const { store, camera, readOnly = false } = useCanvas();
	const host = useRef<HTMLDivElement>(null);
	const selectedId = useCanvasStore(store, (state) => state.selectedId);
	const selected = !readOnly && selectedId === block.id;
	useBlockGestures(store, camera, block.id, block.frame, host, readOnly);

	const onKeyDown = (event: React.KeyboardEvent) => {
		// Keys typed into a control inside the block are the control's.
		if (isTypingTarget(event.target)) return;
		const step = event.shiftKey ? 32 : 8;
		const { x, y } = block.frame;
		const nudge: Record<string, { x?: number; y?: number }> = {
			ArrowLeft: { x: x - step },
			ArrowRight: { x: x + step },
			ArrowUp: { y: y - step },
			ArrowDown: { y: y + step },
		};
		const delta = nudge[event.key];
		if (delta) {
			event.preventDefault();
			store.dispatch({ op: "place", id: block.id, ...delta }, "user");
			return;
		}
		if (event.key === "Backspace" || event.key === "Delete") {
			event.preventDefault();
			store.dispatch({ op: "remove", id: block.id }, "user");
		}
	};

	const frameStyle = {
		left: block.frame.x,
		top: block.frame.y,
		width: block.frame.w,
		height: block.frame.h,
		zIndex: block.frame.z,
	};
	const frameClass =
		"absolute rounded-xl bg-card text-card-foreground ring-1 ring-foreground/10";

	if (readOnly) {
		return (
			<div
				ref={host}
				data-block-id={block.id}
				className={frameClass}
				style={frameStyle}
			>
				<div className="h-full overflow-hidden rounded-xl">
					<BlockBody block={block} selected={false} />
				</div>
			</div>
		);
	}

	return (
		<div
			ref={host}
			data-block-id={block.id}
			data-selected={selected || undefined}
			className={cn(
				frameClass,
				"transition-shadow data-[gesturing]:shadow-lg",
				selected && "ring-2 ring-primary/60",
			)}
			style={frameStyle}
			// A block is a widget with its own keyboard handling (nudge,
			// delete): application is the honest role, and the wrapper must be
			// focusable for those keys to land anywhere.
			// biome-ignore lint/a11y/noNoninteractiveTabindex: keyboard-operable canvas widget
			tabIndex={0}
			role="application"
			aria-label={`${KIND_LABEL[block.kind]} block`}
			onFocus={() => store.select(block.id)}
			onPointerDownCapture={() => {
				store.select(block.id);
				// Clicks land on body content; keyboard ops need the wrapper.
				host.current?.focus();
			}}
			onKeyDown={onKeyDown}
		>
			<div className="h-full overflow-hidden rounded-xl">
				<BlockBody block={block} selected={selected} />
			</div>
			{selected
				? HANDLES.map((dir) => (
						<div
							key={dir}
							data-resize={dir}
							className={cn(
								"absolute size-2.5 rounded-full border border-primary/60 bg-card",
								HANDLE_CLASS[dir],
							)}
						/>
					))
				: null}
		</div>
	);
}

function BlockBody({
	block,
	selected,
}: {
	block: CanvasBlock;
	selected: boolean;
}) {
	switch (block.kind) {
		case "instrument":
			return <InstrumentBlockBody block={block} />;
		case "text":
			return <TextBlockBody block={block} />;
		case "image":
			return <ImageBlockBody block={block} />;
		case "html":
			return <HtmlBlockBody block={block} selected={selected} />;
	}
}
