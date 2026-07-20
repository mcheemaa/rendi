import { HomeComposer } from "@/components/chat/home-composer";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/empty";

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
			<HomeComposer />
		</>
	);
}
