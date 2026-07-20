import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/empty";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "@/components/ui/input-group";
import { Kbd, KbdGroup } from "@/components/ui/kbd";

export default function Home() {
	return (
		<>
			<h1 className="sr-only">Rendi</h1>
			<div className="min-h-0 flex-1 overflow-hidden">
				<Empty className="h-full">
					<EmptyHeader>
						<EmptyTitle className="font-display text-4xl font-normal">
							What should the data become?
						</EmptyTitle>
						<EmptyDescription>
							Ask a question; the answer arrives as a live instrument.
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			</div>
			<div className="shrink-0 px-6 pb-6">
				<InputGroup className="mx-auto h-12! max-w-3xl rounded-xl bg-card shadow-xs">
					<InputGroupInput placeholder="Ask rendi…" aria-label="Ask rendi" />
					<InputGroupAddon align="inline-end">
						<KbdGroup>
							<Kbd>⌘</Kbd>
							<Kbd>⏎</Kbd>
						</KbdGroup>
					</InputGroupAddon>
				</InputGroup>
			</div>
		</>
	);
}
