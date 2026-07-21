"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { AppTopbar } from "@/components/shell/app-topbar";
import { CommandPalette } from "@/components/shell/command-palette";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { ConversationCursor } from "@/lib/db/queries";

export type ConversationRef = { id: string; title: string };

// Server actions arrive as props from the layout, so the shell stays a pure
// client component and stories inject fixtures instead of network.
export type ConversationActions = {
	loadPage: (before?: ConversationCursor) => Promise<{
		items: ConversationRef[];
		cursor: ConversationCursor | null;
	}>;
	search: (query: string) => Promise<ConversationRef[]>;
};

export function AppShell({
	conversations,
	cursor,
	actions,
	children,
}: {
	conversations: ConversationRef[];
	cursor: ConversationCursor | null;
	actions: ConversationActions;
	children: React.ReactNode;
}) {
	const [paletteOpen, setPaletteOpen] = useState(false);
	return (
		<SidebarProvider>
			<AppSidebar
				conversations={conversations}
				cursor={cursor}
				actions={actions}
				onOpenPalette={() => setPaletteOpen(true)}
			/>
			<SidebarInset className="h-svh overflow-hidden">
				<AppTopbar conversations={conversations} />
				{children}
			</SidebarInset>
			<CommandPalette
				conversations={conversations}
				actions={actions}
				open={paletteOpen}
				onOpenChange={setPaletteOpen}
			/>
		</SidebarProvider>
	);
}
