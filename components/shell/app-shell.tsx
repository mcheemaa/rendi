"use client";

import { AppSidebar } from "@/components/shell/app-sidebar";
import { AppTopbar } from "@/components/shell/app-topbar";
import { CommandPalette } from "@/components/shell/command-palette";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export type ConversationRef = { id: string; title: string };

export function AppShell({
	conversations,
	children,
}: {
	conversations: ConversationRef[];
	children: React.ReactNode;
}) {
	return (
		<SidebarProvider>
			<AppSidebar conversations={conversations} />
			<SidebarInset className="h-svh overflow-hidden">
				<AppTopbar conversations={conversations} />
				{children}
			</SidebarInset>
			<CommandPalette conversations={conversations} />
		</SidebarProvider>
	);
}
