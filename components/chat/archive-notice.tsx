import { Archive } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Stands exactly where the composer stands, in its clothes: archived
// conversations read as a quiet room, not a broken input.
export function ArchiveNotice() {
	return (
		<div className="shrink-0 px-6 pb-6">
			<div className="mx-auto flex min-h-24 max-w-3xl flex-col justify-between gap-2.5 rounded-xl border bg-card px-4 py-3 shadow-xs">
				<div className="flex items-start gap-3">
					<Archive
						aria-hidden
						className="mt-0.5 size-4 shrink-0 text-muted-foreground"
					/>
					<div className="min-w-0">
						<p className="text-sm">
							An archived conversation from Rendi&rsquo;s build days, kept as a
							gallery.
						</p>
						<p className="mt-0.5 text-[13px] text-muted-foreground">
							Everything renders live. To talk with Rendi, start a new
							conversation.
						</p>
					</div>
				</div>
				<div className="flex justify-end">
					<Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
						New conversation
					</Link>
				</div>
			</div>
		</div>
	);
}
