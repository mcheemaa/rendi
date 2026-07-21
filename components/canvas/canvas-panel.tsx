"use client";

import { PanelRightClose, Share2, UnfoldHorizontal } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { createShareLink } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { type CanvasDoc, emptyCanvas } from "@/lib/rendi/canvas";
import { cn } from "@/lib/utils";
import { Board } from "./board";
import { createCameraStore } from "./camera";
import { type CanvasContextValue, CanvasProvider } from "./canvas-context";
import {
	type CanvasEvent,
	type CanvasStore,
	createCanvasStore,
} from "./canvas-store";

export type CanvasSnapshot = { doc: CanvasDoc; version: number };

// The conversation's canvas beside the chat. The store is created once and
// never remounts with prop refreshes; server truth (the agent's hand, other
// tabs) arrives through adopt, from the sink response, the poll, and the
// settle refresh.
export function CanvasPanel({
	conversationId,
	initialCanvas,
	wide,
	onToggleWide,
	onClose,
}: {
	conversationId: string;
	initialCanvas: CanvasSnapshot | null;
	wide: boolean;
	onToggleWide: () => void;
	onClose: () => void;
}) {
	const valueRef = useRef<CanvasContextValue | null>(null);
	if (!valueRef.current) {
		let store: CanvasStore | undefined;
		const sink = (event: CanvasEvent) => {
			fetch(`/api/canvas/${conversationId}/ops`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					baseVersion: store?.getState().doc.version ?? 0,
					entry: event.entry,
				}),
			})
				.then((response) => response.json())
				.then((result: CanvasSnapshot | { error: string }) => {
					if (result && "doc" in result) store?.adopt(result.doc);
				})
				.catch((error) => console.error("[canvas] persist failed", error));
		};
		store = createCanvasStore(
			initialCanvas?.doc ?? emptyCanvas(conversationId, "Canvas"),
			sink,
		);
		valueRef.current = {
			store,
			camera: createCameraStore(),
			conversationId,
		};
	}
	const { store } = valueRef.current;

	useEffect(() => {
		const doc = initialCanvas?.doc;
		if (doc && doc.version > store.getState().doc.version) store.adopt(doc);
	}, [initialCanvas, store]);

	// The agent arranges mid-turn from the runner; a light poll keeps the
	// open panel current until a realtime channel earns its keep.
	useEffect(() => {
		const timer = setInterval(async () => {
			try {
				const response = await fetch(`/api/canvas/${conversationId}/ops`);
				const canvas = (await response.json()) as CanvasSnapshot | null;
				if (canvas && canvas.version > store.getState().doc.version) {
					store.adopt(canvas.doc);
				}
			} catch {
				// The next tick retries; the board keeps its local truth.
			}
		}, 2500);
		return () => clearInterval(timer);
	}, [conversationId, store]);

	return (
		<aside
			className={cn(
				"flex min-h-0 shrink-0 flex-col border-l bg-background",
				wide ? "w-[72%]" : "w-[44%]",
			)}
			aria-label="Canvas"
		>
			<div className="flex shrink-0 items-center gap-1.5 border-b px-3 py-1.5">
				<span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
					canvas
				</span>
				<div className="ml-auto flex items-center gap-0.5">
					<Button
						variant="ghost"
						size="icon"
						className="size-7 text-muted-foreground"
						aria-label="Copy share link"
						onClick={async () => {
							const { url } = await createShareLink(conversationId);
							await navigator.clipboard.writeText(url);
							toast.success("Share link copied", {
								description: "Live board, steerable, read-only. 7 days.",
							});
						}}
					>
						<Share2 className="size-3.5" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className="size-7 text-muted-foreground"
						aria-label={wide ? "Narrow the canvas" : "Widen the canvas"}
						onClick={onToggleWide}
					>
						<UnfoldHorizontal className="size-3.5" />
					</Button>
					<Button
						variant="ghost"
						size="icon"
						className="size-7 text-muted-foreground"
						aria-label="Close the canvas"
						onClick={onClose}
					>
						<PanelRightClose className="size-3.5" />
					</Button>
				</div>
			</div>
			<div className="min-h-0 flex-1">
				<CanvasProvider value={valueRef.current}>
					<Board />
				</CanvasProvider>
			</div>
		</aside>
	);
}
