"use client";

import Image from "next/image";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// Food is visual: every thumbnail in a DoorDash card opens to a proper
// look. The thumb is the trigger; the dialog shows the same source at
// its natural aspect.
export function ZoomableImage({
	src,
	name,
	className,
}: {
	src: string;
	name: string;
	className?: string;
}) {
	return (
		<Dialog>
			<DialogTrigger
				aria-label={`View larger: ${name}`}
				className={cn(
					"shrink-0 cursor-zoom-in overflow-hidden rounded-md transition-[scale,box-shadow] hover:scale-[1.03] hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
					className,
				)}
			>
				<Image
					src={src}
					alt=""
					width={96}
					height={96}
					unoptimized
					className="size-full object-cover"
				/>
			</DialogTrigger>
			<DialogContent className="max-w-2xl p-2" showCloseButton>
				<DialogTitle className="sr-only">{name}</DialogTitle>
				<DialogDescription className="sr-only">
					Larger view of {name}
				</DialogDescription>
				{/* Plain img: a lightbox of an arbitrary remote wants the natural
				    aspect, which next/image cannot give without knowing it. */}
				<img
					src={src}
					alt={name}
					className="max-h-[70vh] w-full rounded-lg object-contain"
				/>
			</DialogContent>
		</Dialog>
	);
}
