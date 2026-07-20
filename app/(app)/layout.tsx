import { AppShell } from "@/components/shell/app-shell";
import { listConversations } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function AppLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const conversations = await listConversations();
	return <AppShell conversations={conversations}>{children}</AppShell>;
}
