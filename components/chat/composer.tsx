"use client";

import type { ChatStatus } from "ai";
import { useEffect, useRef } from "react";
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
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const wasBusy = useRef(false);

	// Disabling the textarea while busy drops focus; hand it back when the
	// turn ends so the follow-up can be typed without a click.
	useEffect(() => {
		if (wasBusy.current && !busy && autoFocus) {
			textareaRef.current?.focus({ preventScroll: true });
		}
		wasBusy.current = busy;
	}, [busy, autoFocus]);

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
						ref={textareaRef}
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
