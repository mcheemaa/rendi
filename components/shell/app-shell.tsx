"use client";

import { AppSidebar } from "@/components/shell/app-sidebar";
import { AppTopbar } from "@/components/shell/app-topbar";
import { CommandPalette } from "@/components/shell/command-palette";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export function AppShell({
	title,
	working = false,
	children,
}: {
	title?: string;
	working?: boolean;
	children: React.ReactNode;
}) {
	return (
		<SidebarProvider>
			<AppSidebar working={working} />
			<SidebarInset className="h-svh overflow-hidden">
				<AppTopbar title={title} />
				{children}
			</SidebarInset>
			<CommandPalette />
		</SidebarProvider>
	);
}
