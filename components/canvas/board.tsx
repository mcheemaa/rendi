"use client";

import { Maximize2, Minus, Plus } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { BlockView } from "./block-view";
import { useCamera } from "./camera";
import { useCanvas } from "./canvas-context";
import { useCanvasStore } from "./canvas-store";

export function Board() {
	const { store, camera } = useCanvas();
	const doc = useCanvasStore(store, (state) => state.doc);
	const dragging = useCanvasStore(store, (state) => state.dragging);
	const view = useCamera(camera);
	const viewport = useRef<HTMLDivElement>(null);

	// Open on the whole composition; after that the camera belongs to the
	// viewer's hands alone, so later doc changes never move it.
	useEffect(() => {
		const el = viewport.current;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		camera.fitToContent(store.getState().doc, {
			w: rect.width,
			h: rect.height,
		});
	}, [camera, store]);

	useEffect(() => {
		const el = viewport.current;
		if (!el) return;

		// Wheel must preventDefault (pinch arrives as ctrl+wheel and would
		// zoom the page), which requires a non-passive listener.
		const onWheel = (event: WheelEvent) => {
			event.preventDefault();
			if (event.ctrlKey || event.metaKey) {
				const rect = el.getBoundingClientRect();
				camera.zoomAt(
					event.clientX - rect.left,
					event.clientY - rect.top,
					Math.exp(-event.deltaY * 0.01),
				);
			} else {
				camera.panBy(-event.deltaX, -event.deltaY);
			}
		};
		el.addEventListener("wheel", onWheel, { passive: false });

		// Blocks stop propagation on their own pointerdown, so only true
		// background presses land here and pan the camera.
		let panning: { x: number; y: number } | null = null;
		const onPointerDown = (event: PointerEvent) => {
			if (event.button !== 0) return;
			const target = event.target as HTMLElement;
			if (target !== el && !target.dataset.world) return;
			panning = { x: event.clientX, y: event.clientY };
			el.setPointerCapture(event.pointerId);
			store.select(null);
		};
		const onPointerMove = (event: PointerEvent) => {
			if (!panning) return;
			camera.panBy(event.clientX - panning.x, event.clientY - panning.y);
			panning = { x: event.clientX, y: event.clientY };
		};
		const onPointerUp = () => {
			panning = null;
		};
		el.addEventListener("pointerdown", onPointerDown);
		el.addEventListener("pointermove", onPointerMove);
		el.addEventListener("pointerup", onPointerUp);
		el.addEventListener("pointercancel", onPointerUp);
		return () => {
			el.removeEventListener("wheel", onWheel);
			el.removeEventListener("pointerdown", onPointerDown);
			el.removeEventListener("pointermove", onPointerMove);
			el.removeEventListener("pointerup", onPointerUp);
			el.removeEventListener("pointercancel", onPointerUp);
		};
	}, [camera, store]);

	const viewportSize = () => {
		const rect = viewport.current?.getBoundingClientRect();
		return { w: rect?.width ?? 1200, h: rect?.height ?? 800 };
	};

	return (
		<div
			ref={viewport}
			data-dragging={dragging || undefined}
			className="group/board relative h-full touch-none select-none overflow-hidden bg-background [background-image:radial-gradient(circle,var(--border)_1px,transparent_1px)] [background-size:24px_24px]"
		>
			<div
				data-world
				className="absolute inset-0 origin-top-left"
				style={{
					transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
				}}
			>
				{[...doc.blocks]
					.sort((a, b) => a.frame.z - b.frame.z)
					.map((block) => (
						<BlockView key={block.id} block={block} />
					))}
			</div>
			{doc.blocks.length === 0 ? (
				<div className="pointer-events-none absolute inset-0 flex items-center justify-center">
					<p className="font-mono text-xs text-muted-foreground">
						rendi arranges this canvas as you talk
					</p>
				</div>
			) : null}
			<div className="absolute bottom-4 left-4 flex items-center gap-0.5 rounded-lg bg-card p-1 ring-1 ring-foreground/10">
				<Button
					variant="ghost"
					size="icon"
					className="size-7"
					aria-label="Zoom out"
					onClick={() => camera.setZoom(view.zoom / 1.25, viewportSize())}
				>
					<Minus className="size-3.5" />
				</Button>
				<Button
					variant="ghost"
					className="h-7 px-2 font-mono text-[11px]"
					aria-label="Reset zoom"
					onClick={() => camera.setZoom(1, viewportSize())}
				>
					{Math.round(view.zoom * 100)}%
				</Button>
				<Button
					variant="ghost"
					size="icon"
					className="size-7"
					aria-label="Zoom in"
					onClick={() => camera.setZoom(view.zoom * 1.25, viewportSize())}
				>
					<Plus className="size-3.5" />
				</Button>
				<Button
					variant="ghost"
					size="icon"
					className="size-7"
					aria-label="Fit content"
					onClick={() =>
						camera.fitToContent(store.getState().doc, viewportSize())
					}
				>
					<Maximize2 className="size-3.5" />
				</Button>
			</div>
		</div>
	);
}
