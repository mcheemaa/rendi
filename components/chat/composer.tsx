"use client";

import type { ChatStatus } from "ai";
import {
	PromptInput,
	PromptInputBody,
	PromptInputFooter,
	PromptInputSubmit,
	PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";

export function Composer({
	status,
	onSend,
	onStop,
	autoFocus = false,
}: {
	status: ChatStatus;
	onSend: (text: string) => void;
	onStop: () => void;
	autoFocus?: boolean;
}) {
	const busy = status === "submitted" || status === "streaming";
	return (
		<div className="shrink-0 px-6 pb-6">
			<PromptInput
				className="mx-auto max-w-3xl rounded-xl bg-card shadow-xs"
				onSubmit={({ text }) => {
					if (busy || !text?.trim()) return;
					onSend(text.trim());
				}}
			>
				<PromptInputBody>
					<PromptInputTextarea
						className="min-h-12"
						placeholder={busy ? "Rendi is working…" : "Ask rendi…"}
						aria-label="Ask rendi"
						autoFocus={autoFocus}
						disabled={busy}
					/>
				</PromptInputBody>
				<PromptInputFooter className="justify-end gap-2">
					{busy ? (
						<PromptInputSubmit
							status={status}
							type="button"
							onClick={onStop}
							aria-label="Stop"
						/>
					) : (
						<PromptInputSubmit status={status} />
					)}
				</PromptInputFooter>
			</PromptInput>
		</div>
	);
}
