"use client";

import { useChat } from "@ai-sdk/react";
import { useTriggerChatTransport } from "@trigger.dev/sdk/chat/react";
import type { UIMessage } from "ai";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { mintChatAccessToken, startChatSession } from "@/app/actions";
import { ArchiveNotice } from "@/components/chat/archive-notice";
import { Composer } from "@/components/chat/composer";
import { Transcript } from "@/components/chat/transcript";
import { mergeTranscript } from "@/lib/rendi/transcript-merge";
import type { rendiChat } from "@/trigger/chat";

export type SessionState = {
	publicAccessToken: string;
	lastEventId?: string;
};

export function ChatApp({
	chatId,
	initialMessages,
	session,
	archived = false,
}: {
	chatId: string;
	initialMessages: UIMessage[];
	session?: SessionState;
	archived?: boolean;
}) {
	const router = useRouter();
	const draftConsumed = useRef(false);
	const hadDraft = useRef(false);
	const recoveryTries = useRef(0);
	const lateResumed = useRef(false);
	const stoppedTail = useRef<string | null>(null);
	const resumeTries = useRef({ tail: "", count: 0 });
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
		const merged = mergeTranscript(messages, initialMessages);
		if (merged.changed) {
			setMessages(merged.messages);
			recoveryTries.current = 0;
		}
	}, [initialMessages, messages, setMessages, status]);

	// Turns can also start without this tab sending anything (pulse
	// beats, dataset-ready nudges). While idle, poll persistence for rows
	// this store has not seen. A user-role tail means such a turn is due
	// or already running: the session's not-streaming flag is stale, so
	// reset it and attach to the live stream. Every step is idempotent,
	// and the transport refuses a second subscription, so retries are
	// safe until the turn's rows settle.
	useEffect(() => {
		if (archived || status !== "ready") return;
		let cancelled = false;
		const timer = setInterval(async () => {
			if (document.visibilityState !== "visible") return;
			try {
				const response = await fetch(`/api/conversations/${chatId}/messages`);
				if (!response.ok || cancelled) return;
				const { messages: persisted } = (await response.json()) as {
					messages: UIMessage[];
				};
				if (cancelled) return;
				const merged = mergeTranscript(messages, persisted);
				if (merged.changed) setMessages(merged.messages);
				const tail = merged.messages.at(-1);
				if (tail?.role !== "user") return;
				// A tail the user explicitly stopped stays stopped; anything
				// else gets a bounded number of attach attempts so a turn that
				// never persists a reply cannot hold a resume loop open.
				if (tail.id === stoppedTail.current) return;
				if (resumeTries.current.tail !== tail.id) {
					resumeTries.current = { tail: tail.id, count: 0 };
				}
				if (resumeTries.current.count >= 3) return;
				resumeTries.current.count += 1;
				const live = transport.getSession(chatId);
				if (!live) return;
				// isStreaming true, not omitted: reconnectToStream refuses only
				// an explicit false, and stating the belief keeps this working
				// if the SDK's gate ever tightens to any falsy value.
				transport.setSession(chatId, {
					publicAccessToken: live.publicAccessToken,
					lastEventId: live.lastEventId,
					isStreaming: true,
				});
				resumeStream();
			} catch {
				// The next tick retries.
			}
		}, 3500);
		return () => {
			cancelled = true;
			clearInterval(timer);
		};
	}, [
		archived,
		status,
		chatId,
		messages,
		setMessages,
		transport,
		resumeStream,
	]);

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
		if (archived || status !== "ready") return;
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
	}, [archived, status, messages, router]);

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
			{archived ? (
				<ArchiveNotice />
			) : (
				<Composer
					status={status}
					autoFocus
					onSend={(text) => {
						stoppedTail.current = null;
						sendMessage({ text });
					}}
					onStop={() => {
						const tail = messages.at(-1);
						stoppedTail.current = tail?.role === "user" ? tail.id : null;
						transport.stopGeneration(chatId);
						stop();
					}}
				/>
			)}
		</>
	);
}
