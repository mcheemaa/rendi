import { notFound } from "next/navigation";
import { Transcript } from "@/components/chat/transcript";
import { getConversation, getTranscript } from "@/lib/db/queries";

export default async function ConversationPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	const conversation = await getConversation(id);
	if (!conversation) notFound();
	const transcript = await getTranscript(id);
	return (
		<>
			<h1 className="sr-only">{conversation.title}</h1>
			<Transcript messages={transcript} />
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
