"use client";

import { useEffect, useRef } from "react";
import type { CanvasDoc } from "@/lib/rendi/canvas";
import { BlockView } from "./block-view";
import { contentBounds, createCameraStore } from "./camera";
import { type CanvasContextValue, CanvasProvider } from "./canvas-context";
import { createCanvasStore } from "./canvas-store";

// The agent's eye: a chromeless, interaction-free paint of the document at
// the route's own camera. Content bounds fit inside a 1568px long edge so
// one look costs about 1.5k vision tokens, and the frame is exactly the
// element the screenshot clips to.
const LONG_EDGE = 1568;
const PADDING = 24;

export function RenderBoard({
	doc,
	conversationId,
	theme,
}: {
	doc: CanvasDoc;
	conversationId: string;
	theme: "light" | "dark";
}) {
	const value = useRef<CanvasContextValue | null>(null);
	value.current ??= {
		store: createCanvasStore(doc),
		camera: createCameraStore(),
		conversationId,
	};

	// Chart tokens read the document root, so the route's theme lands there.
	useEffect(() => {
		document.documentElement.classList.toggle("dark", theme === "dark");
		document.documentElement.style.colorScheme = theme;
	}, [theme]);

	const bounds = contentBounds(doc);
	const zoom = Math.min(
		1,
		(LONG_EDGE - PADDING * 2) / Math.max(bounds.w, bounds.h),
	);

	return (
		<div
			data-render-root
			data-expected={doc.blocks.length}
			className="relative overflow-hidden bg-background"
			style={{
				width: bounds.w * zoom + PADDING * 2,
				height: bounds.h * zoom + PADDING * 2,
			}}
		>
			<div
				className="absolute origin-top-left"
				style={{
					transform: `translate(${PADDING - bounds.x * zoom}px, ${PADDING - bounds.y * zoom}px) scale(${zoom})`,
				}}
			>
				<CanvasProvider value={value.current}>
					{[...doc.blocks]
						.sort((a, b) => a.frame.z - b.frame.z)
						.map((block) => (
							<BlockView key={block.id} block={block} />
						))}
				</CanvasProvider>
			</div>
		</div>
	);
}
