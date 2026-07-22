"use client";

import { MousePointer2 } from "lucide-react";
import { useMemo } from "react";
import { MiniChart } from "@/components/home/mini-chart";
import { answerHeatmap, weekdayBars } from "@/components/home/miniature";
import {
	phaseReached,
	type VignettePhase,
} from "@/components/home/use-vignette-player";
import { useEmberTokens } from "@/lib/rendi/charts/tokens";
import { cn } from "@/lib/utils";

const CURSOR_HOME = "translate(298px, 276px)";
const CURSOR_GRAB = "translate(196px, 142px)";
const CURSOR_DROP = "translate(196px, 190px)";

// The app in miniature on one continuous canvas field: the question types,
// the answer lands as a card, blocks land on the board, and the hand settles
// the one that landed tucked too high. Purely decorative; hidden from the
// accessibility tree.
export function Vignette({
	phase,
	text,
	animate,
}: {
	phase: VignettePhase;
	text: string;
	animate: boolean;
}) {
	const tokens = useEmberTokens();
	const reached = (target: VignettePhase) => phaseReached(phase, target);
	const heatOption = useMemo(
		() => (tokens ? answerHeatmap(tokens, animate) : null),
		[tokens, animate],
	);
	const barsOption = useMemo(
		() => (tokens ? weekdayBars(tokens, animate) : null),
		[tokens, animate],
	);

	return (
		<div
			aria-hidden
			className={cn(
				"relative hidden h-[300px] w-[720px] overflow-hidden rounded-2xl border bg-background md:flex",
				"bg-[radial-gradient(circle,var(--border)_1px,transparent_1px)] [background-size:18px_18px]",
				"shadow-[0_1px_2px_rgba(0,0,0,.03),0_22px_48px_-36px_rgba(0,0,0,.4)]",
			)}
		>
			<div className="flex w-[400px] shrink-0 flex-col p-[18px] text-left">
				<div className="flex justify-end">
					<div className="w-fit rounded-xl bg-primary/8 px-4 py-2.5 text-[12.5px]">
						{text}
						{phase !== "rest" && (
							<span className="ml-0.5 inline-block h-3 w-[7px] animate-[caret_0.9s_steps(1)_infinite] bg-primary align-[-1px]" />
						)}
					</div>
				</div>
				<div
					className={cn(
						"mt-3 overflow-hidden rounded-xl border bg-card",
						"shadow-[0_1px_2px_rgba(0,0,0,.03),0_12px_28px_-22px_rgba(0,0,0,.35)]",
						"transition-[opacity,translate] duration-[550ms] ease-[cubic-bezier(0.45,0,0.3,1)]",
						reached("answer")
							? "translate-y-0 opacity-100"
							: "translate-y-2.5 opacity-0",
					)}
				>
					<div className="flex items-center justify-between px-3 pt-2 pb-1">
						<span className="font-display text-[13.5px]">
							Busiest hours, by weekday
						</span>
						<span className="rounded-full border px-1.5 py-px font-mono text-[8.5px] text-muted-foreground">
							last 30d
						</span>
					</div>
					{reached("answer") && heatOption ? (
						<MiniChart option={heatOption} className="h-[136px] w-full" />
					) : (
						<div className="h-[136px] w-full" />
					)}
					<div className="flex justify-between border-t px-3 py-1 font-mono text-[8.5px] text-muted-foreground">
						<span>rendi sees what you change</span>
						<span>70 rows · 61 ms</span>
					</div>
				</div>
			</div>

			<div className="relative flex-1">
				<span className="absolute top-2.5 right-3.5 font-mono text-[8.5px] tracking-[0.16em] text-muted-foreground uppercase">
					canvas
				</span>
				<div
					className={cn(
						"absolute top-10 left-4 h-[108px] w-[170px] overflow-hidden rounded-[10px] border bg-card",
						"shadow-[0_1px_2px_rgba(0,0,0,.05),0_12px_24px_-18px_rgba(0,0,0,.35)]",
						"transition-[opacity,translate,scale] duration-[550ms] ease-[cubic-bezier(0.45,0,0.3,1)]",
						reached("bars")
							? "translate-y-0 scale-100 opacity-100"
							: "translate-y-3 scale-[.97] opacity-0",
					)}
				>
					<div className="px-2.5 pt-1.5 font-display text-[11px]">
						By weekday
					</div>
					{reached("bars") && barsOption ? (
						<MiniChart
							option={barsOption}
							className="h-[calc(100%-24px)] w-full"
						/>
					) : null}
				</div>
				{/* Lands tucked over the bars; the settle animates translate on
				    the same clock and easing as the cursor's transform, so the
				    drag stays frame-locked instead of animating layout. */}
				<div
					className={cn(
						"absolute top-32 left-[118px] h-[88px] w-[186px] rounded-[10px] border bg-card",
						"shadow-[0_1px_2px_rgba(0,0,0,.05),0_12px_24px_-18px_rgba(0,0,0,.35)]",
						"transition-[opacity,translate,scale,border-color] ease-[cubic-bezier(0.45,0,0.3,1)]",
						reached("stat")
							? reached("settle")
								? "translate-y-12 opacity-100 duration-[900ms]"
								: "translate-y-0 opacity-100 duration-[550ms]"
							: "translate-y-3 scale-[.97] opacity-0 duration-[550ms]",
						phase === "beat" || phase === "ticked"
							? "border-primary/60"
							: "border-border",
						phase === "beat" && "animate-[pulse-ring_0.8s_ease-out_2]",
					)}
				>
					<div className="px-2.5 pt-1.5 font-display text-[11px]">Peak</div>
					<div
						className="px-3 pt-0.5"
						key={reached("ticked") ? "after" : "before"}
					>
						<div
							className={cn(
								"font-display text-2xl leading-tight",
								reached("ticked") && "animate-[value-tick_0.5s_ease-out]",
							)}
						>
							{reached("ticked") ? "Wed, 4pm" : "Wed, 2pm"}
						</div>
						<div
							className={cn(
								"mt-1 font-mono text-[8.5px] tracking-[0.12em] text-muted-foreground uppercase",
								reached("ticked") && "animate-[value-tick_0.7s_ease-out]",
							)}
						>
							{reached("ticked") ? "46 commits" : "21 commits"}
						</div>
					</div>
					<span
						className={cn(
							"absolute right-2.5 top-2 font-mono text-[7.5px] tracking-[0.14em] text-primary uppercase",
							"transition-opacity duration-500",
							phase === "beat" || phase === "ticked"
								? "opacity-100"
								: "opacity-0",
						)}
					>
						pulse
					</span>
				</div>
				<MousePointer2
					className={cn(
						"absolute top-0 left-0 z-10 size-[15px] fill-foreground text-card drop-shadow-sm",
						"[transition:transform_.9s_cubic-bezier(0.45,0,0.3,1),opacity_.35s_cubic-bezier(0.45,0,0.3,1)]",
						phase === "approach" || phase === "settle"
							? "opacity-100"
							: "opacity-0",
					)}
					style={{
						transform: reached("settle")
							? CURSOR_DROP
							: reached("approach")
								? CURSOR_GRAB
								: CURSOR_HOME,
					}}
				/>
			</div>
		</div>
	);
}
