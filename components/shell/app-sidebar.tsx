"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RendiMark } from "@/components/brand/rendi-mark";
import { RendiWordmark } from "@/components/brand/rendi-wordmark";
import type { ConversationRef } from "@/components/shell/app-shell";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

export function AppSidebar({
	conversations,
}: {
	conversations: ConversationRef[];
}) {
	const pathname = usePathname() ?? "/";
	return (
		<Sidebar collapsible="icon">
			<SidebarHeader>
				<div className="flex justify-center px-2 pt-1 pb-2">
					<RendiWordmark className="h-13 text-sidebar-foreground group-data-[collapsible=icon]:hidden" />
					<RendiMark className="hidden h-9 text-sidebar-foreground group-data-[collapsible=icon]:inline-flex" />
				</div>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							tooltip="New conversation"
							render={<Link href="/" />}
						>
							<Plus className="text-primary" />
							<span>New conversation</span>
						</SidebarMenuButton>
						<SidebarMenuBadge>
							<KbdGroup>
								<Kbd>⌘</Kbd>
								<Kbd>⇧</Kbd>
								<Kbd>O</Kbd>
							</KbdGroup>
						</SidebarMenuBadge>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Conversations</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu className="gap-1">
							{conversations.map((conversation) => {
								const active = pathname === `/c/${conversation.id}`;
								return (
									<SidebarMenuItem key={conversation.id}>
										<SidebarMenuButton
											isActive={active}
											tooltip={conversation.title}
											render={<Link href={`/c/${conversation.id}`} />}
										>
											<span className="flex size-4 shrink-0 items-center justify-center">
												<span
													className={cn(
														"size-2 rounded-full",
														active ? "bg-primary" : "bg-muted-foreground/50",
													)}
												/>
											</span>
											<span className="truncate">{conversation.title}</span>
										</SidebarMenuButton>
									</SidebarMenuItem>
								);
							})}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>

			<SidebarFooter>
				<div className="flex items-center justify-between px-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
					<ThemeToggle />
					<KbdGroup className="group-data-[collapsible=icon]:hidden">
						<Kbd>⌘</Kbd>
						<Kbd>K</Kbd>
					</KbdGroup>
				</div>
			</SidebarFooter>
			<SidebarRail />
		</Sidebar>
	);
}
