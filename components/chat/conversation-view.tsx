"use client";

import type { UIMessage } from "ai";
import { PanelRight } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import {
	CanvasPanel,
	type CanvasSnapshot,
} from "@/components/canvas/canvas-panel";
import { ChatApp, type SessionState } from "@/components/chat/chat-app";
import { Button } from "@/components/ui/button";

export function ConversationView({
	chatId,
	initialMessages,
	session,
	initialCanvas,
	archived = false,
}: {
	chatId: string;
	initialMessages: UIMessage[];
	session?: SessionState;
	initialCanvas: CanvasSnapshot | null;
	archived?: boolean;
}) {
	// A canvas that already has blocks opens with the conversation, and a
	// live one reveals itself on the agent's first touch. A hand that
	// closed the panel wins for the rest of the session.
	const [canvasOpen, setCanvasOpen] = useState(
		(initialCanvas?.doc.blocks.length ?? 0) > 0,
	);
	const [wide, setWide] = useState(false);
	const userClosed = useRef(false);
	const openForActivity = useCallback(() => {
		if (!userClosed.current) setCanvasOpen(true);
	}, []);

	return (
		<div className="flex min-h-0 flex-1">
			<div className="relative flex min-w-0 flex-1 flex-col">
				<ChatApp
					chatId={chatId}
					initialMessages={initialMessages}
					session={session}
					archived={archived}
					onCanvasActivity={openForActivity}
				/>
				{canvasOpen ? null : (
					<Button
						variant="ghost"
						size="icon"
						className="absolute top-2 right-4 text-muted-foreground"
						aria-label="Open the canvas"
						onClick={() => setCanvasOpen(true)}
					>
						<PanelRight className="size-4" />
					</Button>
				)}
			</div>
			{canvasOpen ? (
				<CanvasPanel
					conversationId={chatId}
					initialCanvas={initialCanvas}
					wide={wide}
					onToggleWide={() => setWide((current) => !current)}
					onClose={() => {
						userClosed.current = true;
						setCanvasOpen(false);
					}}
				/>
			) : null}
		</div>
	);
}
