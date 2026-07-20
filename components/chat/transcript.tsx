"use client";

import type { ToolUIPart, UIMessage } from "ai";
import { Streamdown } from "streamdown";
import {
	Conversation,
	ConversationContent,
	ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
	Reasoning,
	ReasoningContent,
	ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { InstrumentCard } from "@/components/chat/instrument-card";
import { QueryDataCard } from "@/components/chat/query-data-card";
import { instrumentSpec } from "@/lib/rendi/instrument";

export function Transcript({
	messages,
	streamingMessageId,
}: {
	messages: UIMessage[];
	streamingMessageId?: string;
}) {
	return (
		<Conversation className="min-h-0 flex-1">
			<ConversationContent className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-8">
				{messages.map((message) => (
					<Message from={message.role} key={message.id}>
						<MessageContent>
							<Parts
								message={message}
								streaming={message.id === streamingMessageId}
							/>
						</MessageContent>
					</Message>
				))}
			</ConversationContent>
			<ConversationScrollButton />
		</Conversation>
	);
}

function Parts({
	message,
	streaming,
}: {
	message: UIMessage;
	streaming: boolean;
}) {
	return (
		<>
			{message.parts.map((part, index) => {
				const key = `${message.id}-${index}`;
				const lastPart = index === message.parts.length - 1;
				if (part.type === "text") {
					return (
						<Streamdown
							key={key}
							mode={streaming && lastPart ? "streaming" : "static"}
							parseIncompleteMarkdown={streaming && lastPart}
						>
							{part.text}
						</Streamdown>
					);
				}
				if (part.type === "reasoning") {
					// Signature-only blocks (omitted-display era) have no text to show.
					if (!part.text && !(streaming && lastPart)) return null;
					return (
						<Reasoning
							key={key}
							isStreaming={streaming && lastPart}
							defaultOpen={false}
						>
							<ReasoningTrigger />
							<ReasoningContent>{part.text ?? ""}</ReasoningContent>
						</Reasoning>
					);
				}
				if (part.type === "tool-query-data") {
					const sql =
						typeof (part.input as { sql?: string } | undefined)?.sql ===
						"string"
							? (part.input as { sql: string }).sql
							: "";
					return (
						<QueryDataCard
							key={key}
							sql={sql}
							state={part.state as ToolUIPart["state"]}
							output={
								part.state === "output-available"
									? (part.output as {
											rows?: Record<string, unknown>[];
											rowCount?: number;
											truncated?: boolean;
										})
									: undefined
							}
							errorText={
								part.state === "output-error" ? part.errorText : undefined
							}
						/>
					);
				}
				if (part.type === "data-instrument") {
					const parsed = instrumentSpec.safeParse(part.data);
					if (!parsed.success) return null;
					const data = part.data as { id?: string; version?: number };
					return (
						<InstrumentCard
							key={key}
							instrument={{
								...parsed.data,
								id: data.id ?? key,
								version: data.version ?? 1,
							}}
						/>
					);
				}
				return null;
			})}
		</>
	);
}
