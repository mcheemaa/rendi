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
		label: "What is trigger.dev's team shipping?",
		prompt:
			"Sync trigger.dev's commits, then show me what the team has been shipping lately. Put up a first chart as soon as you have one, then build out a small focused board: recent work over ancient history.",
		dot: "bg-[#41ff54]",
	},
	{
		label: "Chart seventeen years of ClickHouse",
		prompt:
			"Chart seventeen years of ClickHouse development from the git data: the long tide of commits over time, who the eras belonged to, how the team grew. Render your first view as soon as a query lands and add the rest incrementally, three or four charts, at least one steerable.",
		dot: "bg-[#151515] dark:bg-[#fcff74]",
	},
	{
		label: "Where did London house prices go?",
		prompt:
			"Using the UK property prices data, tell the story of London against the rest of the country. First chart quickly, then deepen: a steerable time window, and one view that surprises you.",
		dot: "bg-chart-2",
	},
	{
		label: "What data can you load for me?",
		prompt:
			"What data do you have, and what can you load? Show me the catalog and what is already live, and if something interesting is not loaded yet, offer to load it.",
		dot: "bg-[#e8a33d]",
	},
	{
		label: "Make something beautiful. Surprise me.",
		prompt:
			"Make me something beautiful from the Hacker News data. Surprise me: your native charts where they serve, a hand-built D3 piece if it earns its place, an image if it sets the mood. Put value on screen early and keep composing.",
		dot: "bg-[#ff6600]",
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
						className="h-auto cursor-pointer rounded-xl bg-card/75 px-4 py-2.5 font-normal shadow-xs backdrop-blur-md dark:bg-card/75"
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
