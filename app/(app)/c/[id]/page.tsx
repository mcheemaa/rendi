import { notFound } from "next/navigation";
import { ConversationView } from "@/components/chat/conversation-view";
import { getConversation, getTranscript } from "@/lib/db/queries";
import { isArchived } from "@/lib/rendi/archive";
import { loadCanvas } from "@/lib/rendi/harness/canvas-db";

const CHAT_ID =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export default async function ConversationPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const conversation = await getConversation(id);
	// A well-formed id without a row does not exist YET (the harness writes
	// it at turn start); render the pending chat instead of racing to a 404.
	if (!conversation && !CHAT_ID.test(id)) notFound();
	const [transcript, canvas] = conversation
		? await Promise.all([getTranscript(id), loadCanvas(id)])
		: [[], undefined];
	return (
		<>
			<h1 className="sr-only">{conversation?.title ?? "New conversation"}</h1>
			{/* Keyed by conversation identity only: React reuses same-type client
			    components across route param changes, and chat state must never
			    bleed between conversations. Within a conversation, never remount. */}
			<ConversationView
				key={id}
				chatId={id}
				initialMessages={transcript}
				initialCanvas={canvas ?? null}
				archived={conversation ? isArchived(conversation.createdAt) : false}
				session={
					conversation?.publicAccessToken
						? {
								publicAccessToken: conversation.publicAccessToken,
								lastEventId: conversation.lastEventId ?? undefined,
							}
						: undefined
				}
			/>
		</>
	);
}

export async function generateMetadata({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const conversation = await getConversation(id);
	return { title: conversation ? `${conversation.title} · Rendi` : "Rendi" };
}
