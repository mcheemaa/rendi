"use client";

import type { UIMessage } from "ai";
import { PanelRight } from "lucide-react";
import { useState } from "react";
import { CanvasPanel } from "@/components/canvas/canvas-panel";
import { ChatApp, type SessionState } from "@/components/chat/chat-app";
import { Button } from "@/components/ui/button";

export function ConversationView({
	chatId,
	initialMessages,
	session,
}: {
	chatId: string;
	initialMessages: UIMessage[];
	session?: SessionState;
}) {
	const [canvasOpen, setCanvasOpen] = useState(false);
	const [wide, setWide] = useState(false);

	return (
		<div className="flex min-h-0 flex-1">
			<div className="relative flex min-w-0 flex-1 flex-col">
				<ChatApp
					chatId={chatId}
					initialMessages={initialMessages}
					session={session}
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
					wide={wide}
					onToggleWide={() => setWide((current) => !current)}
					onClose={() => setCanvasOpen(false)}
				/>
			) : null}
		</div>
	);
}
