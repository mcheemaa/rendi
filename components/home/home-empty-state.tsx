"use client";

import { Hallmark } from "@/components/home/hallmark";
import { useVignettePlayer } from "@/components/home/use-vignette-player";
import { Vignette } from "@/components/home/vignette";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

const QUESTION = "busiest hours by weekday?";

const SUGGESTIONS = [
	{
		label: "GitHub-style calendar of commits",
		prompt: "Show a GitHub-style contributions calendar of commits",
		dot: "bg-chart-1",
	},
	{
		label: "Build a dashboard on the canvas",
		prompt: "Build a commit dashboard on the canvas",
		dot: "bg-chart-2",
	},
	{
		label: "Keep a board fresh every morning",
		prompt:
			"Build a commits dashboard on the canvas and set yourself a pulse to keep it fresh every morning at 9.",
		dot: "bg-chart-3",
	},
] as const;

export function HomeEmptyState({
	onPick,
}: {
	onPick: (prompt: string) => void;
}) {
	const { phase, text, animate } = useVignettePlayer(QUESTION);

	return (
		<Empty className="relative z-[1] h-full">
			<EmptyHeader className="max-w-none">
				<Hallmark className="mb-5" />
				<EmptyMedia className="mb-4">
					<Vignette phase={phase} text={text} animate={animate} />
				</EmptyMedia>
				<EmptyTitle className="font-display text-[42px] leading-tight font-normal">
					What do you want to see?
				</EmptyTitle>
				<EmptyDescription className="text-[15px]">
					Ask in plain words; it arrives drawn, live, and yours to own.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent className="max-w-none flex-row flex-wrap justify-center gap-2.5">
				{SUGGESTIONS.map((suggestion) => (
					<Button
						key={suggestion.label}
						variant="outline"
						className="h-auto rounded-xl bg-card/75 px-4 py-2.5 font-normal shadow-xs backdrop-blur-md dark:bg-card/75"
						onClick={() => onPick(suggestion.prompt)}
					>
						<span
							aria-hidden
							className={cn("size-[7px] rounded-[2px]", suggestion.dot)}
						/>
						{suggestion.label}
					</Button>
				))}
			</EmptyContent>
		</Empty>
	);
}
