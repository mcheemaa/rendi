import Link from "next/link";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@/components/ui/empty";

export default function NotFound() {
	return (
		<div className="min-h-0 flex-1 overflow-hidden">
			<Empty className="h-full">
				<EmptyHeader>
					<EmptyTitle className="font-display text-3xl font-normal">
						Nothing here
					</EmptyTitle>
					<EmptyDescription>
						This conversation does not exist, or not yet.{" "}
						<Link
							href="/"
							className="text-accent-text underline-offset-4 hover:underline"
						>
							Start a new one.
						</Link>
					</EmptyDescription>
				</EmptyHeader>
			</Empty>
		</div>
	);
}
