"use client";

import { Moon, PanelLeft, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import type { ConversationRef } from "@/components/shell/app-shell";
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
}: {
	conversations: ConversationRef[];
}) {
	const [open, setOpen] = useState(false);
	const router = useRouter();
	const { resolvedTheme, setTheme } = useTheme();
	const { toggleSidebar } = useSidebar();

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				setOpen((current) => !current);
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
	}, [router]);

	const run = (action: () => void) => {
		setOpen(false);
		action();
	};

	return (
		<CommandDialog open={open} onOpenChange={setOpen} title="Command palette">
			<Command>
				<CommandInput placeholder="Search conversations, actions…" />
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
					</CommandGroup>
					{conversations.length > 0 ? (
						<CommandGroup heading="Conversations">
							{conversations.map((conversation) => (
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
