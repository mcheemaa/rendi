"use client";

import type { ToolUIPart } from "ai";
import { HeartPulse } from "lucide-react";
import { useState } from "react";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Tool, ToolContent, ToolHeader } from "@/components/ai-elements/tool";
import { cn } from "@/lib/utils";

type PulseInput = {
	op?: "set" | "list" | "remove";
	instruction?: string;
	cron?: string;
};

type PulseOutput = {
	id?: string;
	cron?: string;
	timezone?: string;
	next_run?: string | null;
	updated?: boolean;
	removed?: string;
	pulses?: Array<{
		id: string;
		instruction: string;
		cron: string;
		beats: number;
		last_beat_at: string | null;
	}>;
};

const TITLES = {
	set: "Set a pulse",
	list: "Pulses",
	remove: "Removed a pulse",
} as const;

// The receipt for the most invisible side effect in the product: a pulse
// changes nothing now and everything later, so the standing instruction is
// the content and the card opens with it.
export function PulseCard({
	state,
	input,
	output,
	errorText,
	interrupted = false,
}: {
	state: ToolUIPart["state"];
	input?: PulseInput;
	output?: PulseOutput;
	errorText?: string;
	interrupted?: boolean;
}) {
	const op = input?.op ?? "set";
	// Frozen at first render: input streams in after mount, and an
	// uncontrolled Collapsible must not change its default afterwards.
	const [defaultOpen] = useState(() => op !== "list");
	return (
		<Tool defaultOpen={defaultOpen} className="bg-card">
			<ToolHeader
				type="tool-pulse-ops"
				state={state}
				title={TITLES[op]}
				icon={<HeartPulse className="size-3.5 text-muted-foreground" />}
				summary={
					<span
						className={cn(
							"font-mono text-xs",
							errorText ? "text-destructive" : "text-muted-foreground",
						)}
					>
						{headerSummary(op, output, errorText, interrupted)}
					</span>
				}
			/>
			<ToolContent>
				<div className="border-t px-3 py-3">
					{errorText ? (
						<p className="font-mono text-xs text-destructive">{errorText}</p>
					) : output ? (
						<PulseBody op={op} input={input} output={output} />
					) : interrupted ? (
						<p className="font-mono text-xs text-muted-foreground">
							interrupted
						</p>
					) : (
						<Shimmer className="font-mono text-xs">
							talking to the scheduler
						</Shimmer>
					)}
				</div>
			</ToolContent>
		</Tool>
	);
}

function headerSummary(
	op: keyof typeof TITLES,
	output?: PulseOutput,
	errorText?: string,
	interrupted = false,
): string {
	if (errorText) return "failed";
	if (!output) return interrupted ? "interrupted" : "scheduling";
	if (op === "list") {
		const count = output.pulses?.length ?? 0;
		return `${count} ${count === 1 ? "pulse" : "pulses"}`;
	}
	if (op === "remove") return "stopped";
	return [output.cron, output.updated ? "updated" : null]
		.filter(Boolean)
		.join(" · ");
}

function PulseBody({
	op,
	input,
	output,
}: {
	op: keyof typeof TITLES;
	input?: PulseInput;
	output: PulseOutput;
}) {
	if (op === "list") {
		if (!output.pulses?.length) {
			return (
				<p className="font-mono text-xs text-muted-foreground">
					no pulses here
				</p>
			);
		}
		return (
			<ul className="space-y-2">
				{output.pulses.map((pulse) => (
					<li key={pulse.id} className="text-sm">
						<p>{pulse.instruction}</p>
						<p className="mt-0.5 font-mono text-xs text-muted-foreground">
							{pulse.cron} · {pulse.beats}{" "}
							{pulse.beats === 1 ? "beat" : "beats"}
							{pulse.last_beat_at
								? ` · last ${formatWhen(pulse.last_beat_at)}`
								: ""}
						</p>
					</li>
				))}
			</ul>
		);
	}
	if (op === "remove") {
		return (
			<p className="font-mono text-xs text-muted-foreground">
				The schedule is gone; nothing fires again.
			</p>
		);
	}
	return (
		<div className="text-sm">
			{input?.instruction ? <p>{input.instruction}</p> : null}
			<p className="mt-1.5 font-mono text-xs text-muted-foreground">
				{output.cron}
				{output.timezone && output.timezone !== "UTC"
					? ` (${output.timezone})`
					: ""}
				{output.next_run ? ` · next ${formatWhen(output.next_run)}` : ""}
			</p>
		</div>
	);
}

function formatWhen(iso: string): string {
	return new Date(iso).toLocaleString("en-US", {
		month: "short",
		day: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}
