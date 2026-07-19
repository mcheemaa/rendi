"use client";

import { ChartColumn, ChartLine, Moon, PanelLeft, Plus } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { conversations, instruments } from "@/components/shell/shell-data";
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

const instrumentIcons = { bar: ChartColumn, line: ChartLine } as const;

export function CommandPalette() {
	const [open, setOpen] = useState(false);
	const { resolvedTheme, setTheme } = useTheme();
	const { toggleSidebar } = useSidebar();

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
				event.preventDefault();
				setOpen((current) => !current);
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	const run = (action: () => void) => {
		setOpen(false);
		action();
	};

	return (
		<CommandDialog open={open} onOpenChange={setOpen} title="Command palette">
			<Command>
				<CommandInput placeholder="Search instruments, conversations, actions…" />
				<CommandList>
					<CommandEmpty>Nothing matches.</CommandEmpty>
					<CommandGroup heading="Actions">
						<CommandItem onSelect={() => run(() => {})}>
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
					<CommandGroup heading="Conversations">
						{conversations.map((conversation) => (
							<CommandItem key={conversation.id} onSelect={() => run(() => {})}>
								<span className="flex size-4 items-center justify-center">
									<span className="size-[7px] rounded-full bg-muted-foreground/60" />
								</span>
								{conversation.title}
							</CommandItem>
						))}
					</CommandGroup>
					<CommandGroup heading="Instruments">
						{instruments.map((instrument) => {
							const Icon = instrumentIcons[instrument.kind];
							return (
								<CommandItem key={instrument.id} onSelect={() => run(() => {})}>
									<Icon />
									{instrument.title}
								</CommandItem>
							);
						})}
					</CommandGroup>
				</CommandList>
			</Command>
		</CommandDialog>
	);
}
