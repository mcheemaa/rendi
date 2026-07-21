"use client";

import { Activity, Moon, PanelLeft, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useMemo, useRef, useState } from "react";
import type {
	ConversationActions,
	ConversationRef,
} from "@/components/shell/app-shell";
import {
	Command,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandShortcut,
} from "@/components/ui/command";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { useSidebar } from "@/components/ui/sidebar";

export function CommandPalette({
	conversations,
	actions,
	open,
	onOpenChange,
}: {
	conversations: ConversationRef[];
	actions: ConversationActions;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const router = useRouter();
	const { resolvedTheme, setTheme } = useTheme();
	const { toggleSidebar } = useSidebar();
	const [query, setQuery] = useState("");
	const [fetched, setFetched] = useState<ConversationRef[]>([]);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				onOpenChange(!open);
			}
			if (
				(event.metaKey || event.ctrlKey) &&
				event.shiftKey &&
				event.key.toLowerCase() === "o"
			) {
				event.preventDefault();
				router.push("/");
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [router, open, onOpenChange]);

	// The palette reaches past the loaded page: typing pulls server matches
	// into the pool, and Command's own filter ranks the union.
	const searchSeq = useRef(0);
	useEffect(() => {
		const trimmed = query.trim();
		if (!trimmed || !open) return;
		const seq = ++searchSeq.current;
		const timer = setTimeout(async () => {
			const found = await actions.search(trimmed);
			if (seq === searchSeq.current) setFetched(found);
		}, 250);
		return () => clearTimeout(timer);
	}, [query, open, actions]);

	const pool = useMemo(() => {
		const seen = new Set(conversations.map((row) => row.id));
		return [...conversations, ...fetched.filter((row) => !seen.has(row.id))];
	}, [conversations, fetched]);

	const run = (action: () => void) => {
		onOpenChange(false);
		action();
	};

	return (
		<CommandDialog
			open={open}
			onOpenChange={onOpenChange}
			title="Command palette"
		>
			<Command>
				<CommandInput
					placeholder="Search conversations, actions…"
					value={query}
					onValueChange={setQuery}
				/>
				<CommandList>
					<CommandEmpty>Nothing matches.</CommandEmpty>
					<CommandGroup heading="Actions">
						<CommandItem onSelect={() => run(() => router.push("/"))}>
							<Plus />
							New conversation
							<CommandShortcut>
								<KbdGroup>
									<Kbd>⌘</Kbd>
									<Kbd>⇧</Kbd>
									<Kbd>O</Kbd>
								</KbdGroup>
							</CommandShortcut>
						</CommandItem>
						<CommandItem
							onSelect={() =>
								run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))
							}
						>
							<Moon />
							Toggle theme
						</CommandItem>
						<CommandItem onSelect={() => run(toggleSidebar)}>
							<PanelLeft />
							Toggle sidebar
						</CommandItem>
						<CommandItem
							onSelect={() => run(() => router.push("/observability"))}
						>
							<Activity />
							Open observability
						</CommandItem>
					</CommandGroup>
					{pool.length > 0 ? (
						<CommandGroup heading="Conversations">
							{pool.map((conversation) => (
								<CommandItem
									key={conversation.id}
									value={conversation.id}
									keywords={[conversation.title]}
									onSelect={() =>
										run(() => router.push(`/c/${conversation.id}`))
									}
								>
									<span className="flex size-4 items-center justify-center">
										<span className="size-[7px] rounded-full bg-muted-foreground/60" />
									</span>
									{conversation.title}
								</CommandItem>
							))}
						</CommandGroup>
					) : null}
				</CommandList>
			</Command>
		</CommandDialog>
	);
}
