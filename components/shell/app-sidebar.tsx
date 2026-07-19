"use client";

import { ChartColumn, ChartLine, Plus } from "lucide-react";
import { RendiMark } from "@/components/brand/rendi-mark";
import { RendiWordmark } from "@/components/brand/rendi-wordmark";
import { conversations, instruments } from "@/components/shell/shell-data";
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

const instrumentIcons = { bar: ChartColumn, line: ChartLine } as const;

export function AppSidebar({ working = false }: { working?: boolean }) {
	return (
		<Sidebar collapsible="icon">
			<SidebarHeader>
				<div className="flex justify-center px-2 pt-1 pb-2">
					<RendiWordmark
						working={working}
						className="h-13 text-sidebar-foreground group-data-[collapsible=icon]:hidden"
					/>
					<RendiMark
						working={working}
						className="hidden h-9 text-sidebar-foreground group-data-[collapsible=icon]:inline-flex"
					/>
				</div>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton tooltip="New conversation">
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
							{conversations.map((conversation) => (
								<SidebarMenuItem key={conversation.id}>
									<SidebarMenuButton
										isActive={conversation.active}
										tooltip={conversation.title}
									>
										<span className="flex size-4 shrink-0 items-center justify-center">
											<span
												className={cn(
													"size-2 rounded-full",
													conversation.active
														? "bg-primary"
														: "bg-muted-foreground/50",
												)}
											/>
										</span>
										<span>{conversation.title}</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							))}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>

				<SidebarGroup>
					<SidebarGroupLabel>Instruments</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu className="gap-1">
							{instruments.map((instrument) => {
								const Icon = instrumentIcons[instrument.kind];
								return (
									<SidebarMenuItem key={instrument.id}>
										<SidebarMenuButton tooltip={instrument.title}>
											<Icon />
											<span>{instrument.title}</span>
										</SidebarMenuButton>
										<SidebarMenuBadge>
											<span
												className="size-1.5 rounded-full bg-live"
												aria-hidden
											/>
										</SidebarMenuBadge>
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
