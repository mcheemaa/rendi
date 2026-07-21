"use client";

import { PanelRightClose, UnfoldHorizontal } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { emptyCanvas } from "@/lib/rendi/canvas";
import { cn } from "@/lib/utils";
import { Board } from "./board";
import { createCameraStore } from "./camera";
import { CanvasProvider } from "./canvas-context";
import { createCanvasStore } from "./canvas-store";

// The conversation's canvas, opened beside the chat. Stores live for the
// panel's lifetime; C3 seeds the document from Neon and wires the dispatch
// sink to the ops route.
export function CanvasPanel({
	conversationId,
	wide,
	onToggleWide,
	onClose,
}: {
	conversationId: string;
	wide: boolean;
	onToggleWide: () => void;
	onClose: () => void;
}) {
	const value = useMemo(
		() => ({
			store: createCanvasStore(emptyCanvas(conversationId, "Canvas")),
			camera: createCameraStore(),
			conversationId,
		}),
		[conversationId],
	);

	return (
		<aside
			className={cn(
				"flex min-h-0 shrink-0 flex-col border-l bg-background",
				wide ? "w-[72%]" : "w-[44%]",
			)}
			aria-label="Canvas"
		>
			<header className="flex shrink-0 items-center gap-1.5 border-b px-3 py-1.5">
				<span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
					canvas
				</span>
				<div className="ml-auto flex items-center gap-0.5">
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
			</header>
			<div className="min-h-0 flex-1">
				<CanvasProvider value={value}>
					<Board />
				</CanvasProvider>
			</div>
		</aside>
	);
}
