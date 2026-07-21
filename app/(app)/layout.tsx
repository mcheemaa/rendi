import { fetchConversationPage, findConversations } from "@/app/actions";
import { AppShell } from "@/components/shell/app-shell";
import { listConversations } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function AppLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const page = await listConversations();
	return (
		<AppShell
			conversations={page.items.map(({ id, title }) => ({ id, title }))}
			cursor={page.cursor}
			actions={{ loadPage: fetchConversationPage, search: findConversations }}
		>
			{children}
		</AppShell>
	);
}
