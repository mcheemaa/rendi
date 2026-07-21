"use client";

import type { ToolUIPart, UIMessage } from "ai";
import { Streamdown } from "streamdown";
import {
	Conversation,
	ConversationContent,
	ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Loader } from "@/components/ai-elements/loader";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
	Reasoning,
	ReasoningContent,
	ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { ImageCard } from "@/components/chat/image-card";
import { InstrumentCard } from "@/components/chat/instrument-card";
import { QueryDataCard } from "@/components/chat/query-data-card";
import { ScreenshotCard } from "@/components/chat/screenshot-card";
import { persistedInstrumentSpec } from "@/lib/rendi/instrument";

export function Transcript({
	messages,
	conversationId,
	streamingMessageId,
	pending = false,
}: {
	messages: UIMessage[];
	conversationId: string;
	streamingMessageId?: string;
	pending?: boolean;
}) {
	return (
		<Conversation className="min-h-0 flex-1">
			<ConversationContent className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-8">
				{messages.map((message) => (
					<Message from={message.role} key={message.id}>
						<MessageContent>
							<Parts
								message={message}
								conversationId={conversationId}
								streaming={message.id === streamingMessageId}
							/>
						</MessageContent>
					</Message>
				))}
				{pending ? (
					<Message from="assistant">
						<MessageContent>
							{/* self-start beats the flex column's stretch, pinning the
							    spinner where the reply's first character will land. */}
							<Loader className="self-start text-muted-foreground" />
						</MessageContent>
					</Message>
				) : null}
			</ConversationContent>
			<ConversationScrollButton />
		</Conversation>
	);
}

function Parts({
	message,
	conversationId,
	streaming,
}: {
	message: UIMessage;
	conversationId: string;
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
				if (part.type === "tool-screenshot-canvas") {
					return (
						<ScreenshotCard
							key={key}
							state={part.state as ToolUIPart["state"]}
							output={
								part.state === "output-available"
									? (part.output as {
											theme?: string;
											width?: number;
											height?: number;
											pngBase64?: string;
										})
									: undefined
							}
							errorText={
								part.state === "output-error" ? part.errorText : undefined
							}
						/>
					);
				}
				if (part.type === "tool-generate-image") {
					return (
						<ImageCard
							key={key}
							state={part.state as ToolUIPart["state"]}
							input={
								part.state === "input-available" ||
								part.state === "output-available" ||
								part.state === "output-error"
									? (part.input as {
											prompt?: string;
											source_image_id?: string;
										})
									: undefined
							}
							output={
								part.state === "output-available"
									? (part.output as {
											image_id?: string;
											url?: string;
											width?: number;
											height?: number;
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
					const parsed = persistedInstrumentSpec.safeParse(part.data);
					if (!parsed.success) return null;
					const data = part.data as { id?: string; version?: number };
					return (
						<InstrumentCard
							key={key}
							conversationId={conversationId}
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
