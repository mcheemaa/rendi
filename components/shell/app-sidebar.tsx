"use client";

import { ChevronDown, Plus, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { RendiMark } from "@/components/brand/rendi-mark";
import { RendiWordmark } from "@/components/brand/rendi-wordmark";
import type {
	ConversationActions,
	ConversationRef,
} from "@/components/shell/app-shell";
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
	SidebarInput,
	SidebarMenu,
	SidebarMenuBadge,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import type { ConversationCursor } from "@/lib/db/queries";
import { cn } from "@/lib/utils";

export function AppSidebar({
	conversations,
	cursor: initialCursor,
	actions,
	onOpenPalette,
}: {
	conversations: ConversationRef[];
	cursor: ConversationCursor | null;
	actions: ConversationActions;
	onOpenPalette: () => void;
}) {
	const pathname = usePathname() ?? "/";
	// The head page refreshes from the server (new conversations, renames);
	// loaded tail pages persist locally and dedupe against it.
	const [tail, setTail] = useState<ConversationRef[]>([]);
	const [cursor, setCursor] = useState(initialCursor);
	const [loadingMore, setLoadingMore] = useState(false);
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<ConversationRef[] | null>(null);

	const merged = useMemo(() => {
		const seen = new Set(conversations.map((row) => row.id));
		return [...conversations, ...tail.filter((row) => !seen.has(row.id))];
	}, [conversations, tail]);

	// Instant local matches while the server search is in flight.
	const shown = useMemo(() => {
		const trimmed = query.trim().toLowerCase();
		if (!trimmed) return merged;
		if (results) return results;
		return merged.filter((row) => row.title.toLowerCase().includes(trimmed));
	}, [query, results, merged]);

	const searchSeq = useRef(0);
	useEffect(() => {
		const trimmed = query.trim();
		if (!trimmed) {
			setResults(null);
			return;
		}
		const seq = ++searchSeq.current;
		const timer = setTimeout(async () => {
			const found = await actions.search(trimmed);
			if (seq === searchSeq.current) setResults(found);
		}, 250);
		return () => clearTimeout(timer);
	}, [query, actions]);

	const loadMore = async () => {
		if (!cursor || loadingMore) return;
		setLoadingMore(true);
		try {
			const page = await actions.loadPage(cursor);
			setTail((current) => [...current, ...page.items]);
			setCursor(page.cursor);
		} finally {
			setLoadingMore(false);
		}
	};

	const searching = query.trim().length > 0;

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
					{/* The rail keeps search one click away: the palette IS the
					    collapsed search surface. */}
					<SidebarMenuItem className="hidden group-data-[collapsible=icon]:block">
						<SidebarMenuButton
							tooltip="Search conversations"
							onClick={onOpenPalette}
						>
							<Search />
							<span>Search</span>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
				<SidebarInput
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Search conversations"
					aria-label="Search conversations"
					className="group-data-[collapsible=icon]:hidden"
				/>
			</SidebarHeader>

			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>
						{searching ? "Matches" : "Conversations"}
					</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu className="gap-1">
							{shown.map((conversation) => {
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
							{searching && shown.length === 0 ? (
								<li className="px-2 py-1.5 text-sidebar-foreground/60 text-sm">
									No matches.
								</li>
							) : null}
							{!searching && cursor ? (
								<SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
									<SidebarMenuButton
										onClick={loadMore}
										disabled={loadingMore}
										className="text-sidebar-foreground/70"
									>
										{loadingMore ? (
											<Spinner className="size-4" />
										) : (
											<ChevronDown />
										)}
										<span>{loadingMore ? "Loading" : "Load more"}</span>
									</SidebarMenuButton>
								</SidebarMenuItem>
							) : null}
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
