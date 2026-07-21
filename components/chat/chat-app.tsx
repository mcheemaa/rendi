"use client";

import { useChat } from "@ai-sdk/react";
import { useTriggerChatTransport } from "@trigger.dev/sdk/chat/react";
import type { UIMessage } from "ai";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { mintChatAccessToken, startChatSession } from "@/app/actions";
import { Composer } from "@/components/chat/composer";
import { Transcript } from "@/components/chat/transcript";
import type { rendiChat } from "@/trigger/chat";

export type SessionState = {
	publicAccessToken: string;
	lastEventId?: string;
};

export function ChatApp({
	chatId,
	initialMessages,
	session,
}: {
	chatId: string;
	initialMessages: UIMessage[];
	session?: SessionState;
}) {
	const router = useRouter();
	const draftConsumed = useRef(false);
	const hadDraft = useRef(false);
	const recoveryTries = useRef(0);
	const lateResumed = useRef(false);
	const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
		undefined,
	);

	const transport = useTriggerChatTransport<typeof rendiChat>({
		task: "rendi-chat",
		accessToken: ({ chatId: id }) => mintChatAccessToken(id),
		startSession: ({ chatId: id, clientData }) =>
			startChatSession({ chatId: id, clientData }),
		sessions: session ? { [chatId]: session } : undefined,
	});

	const { messages, sendMessage, setMessages, resumeStream, status, stop } =
		useChat({
			id: chatId,
			messages: initialMessages,
			transport,
			resume: initialMessages.length > 0,
			onFinish: () => {
				// One refresh, after the title lands (~1s post-stream): the
				// sidebar updates once with the real name instead of popping in
				// as "New conversation" and renaming moments later.
				clearTimeout(settleTimer.current);
				settleTimer.current = setTimeout(() => router.refresh(), 2500);
			},
			onError: (error) => toast.error(String(error)),
		});

	useEffect(() => () => clearTimeout(settleTimer.current), []);

	// The transport is built once, so a session token that arrives after
	// mount (spectator pages that beat onChatStart) is injected in place;
	// remounting for it would flash the whole pane.
	useEffect(() => {
		if (!session) return;
		transport.setSession(chatId, session);
		if (lateResumed.current || hadDraft.current) return;
		if (status === "ready" && messages.at(-1)?.role === "user") {
			lateResumed.current = true;
			resumeStream();
		}
	}, [session, chatId, transport, status, messages, resumeStream]);

	// useChat treats `messages` as initial state only, so server truth
	// brought in by router.refresh() must be adopted explicitly or the
	// recovery poll below repaints nothing. Progress renews the poll budget.
	useEffect(() => {
		if (status === "submitted" || status === "streaming") return;
		if (initialMessages.length > messages.length) {
			setMessages(initialMessages);
			recoveryTries.current = 0;
		}
	}, [initialMessages, messages.length, setMessages, status]);

	// A home-page draft rides sessionStorage so the first send happens
	// here, after navigation, with zero rows created until turn start.
	useEffect(() => {
		if (draftConsumed.current) return;
		draftConsumed.current = true;
		const draft = sessionStorage.getItem(`rendi:draft:${chatId}`);
		if (draft) {
			sessionStorage.removeItem(`rendi:draft:${chatId}`);
			hadDraft.current = true;
			sendMessage({ text: draft });
		}
	}, [chatId, sendMessage]);

	// Cold loads that beat the harness (empty page, or a user message
	// whose reply has not persisted yet) self-heal with a bounded poll.
	useEffect(() => {
		if (status !== "ready") return;
		if (hadDraft.current) return;
		const empty = messages.length === 0;
		const dangling = messages.at(-1)?.role === "user";
		if (!empty && !dangling) return;
		if (recoveryTries.current >= 3) return;
		const timer = setTimeout(() => {
			recoveryTries.current += 1;
			router.refresh();
		}, 1500);
		return () => clearTimeout(timer);
	}, [status, messages, router]);

	const last = messages.at(-1);
	// Dead air between send and the first visible part: covers session
	// create, run dequeue, and the model's silent lead-in.
	const pending =
		status === "submitted" ||
		(status === "streaming" &&
			(last?.role !== "assistant" ||
				!last.parts.some((part) => part.type !== "step-start")));

	return (
		<>
			<Transcript
				messages={messages}
				conversationId={chatId}
				streamingMessageId={
					status === "streaming" ? messages.at(-1)?.id : undefined
				}
				pending={pending}
			/>
			<Composer
				status={status}
				autoFocus
				onSend={(text) => sendMessage({ text })}
				onStop={() => {
					transport.stopGeneration(chatId);
					stop();
				}}
			/>
		</>
	);
}
