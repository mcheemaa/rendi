"use client";

import type { ToolUIPart } from "ai";
import { ScanEye } from "lucide-react";
import Image from "next/image";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Tool, ToolContent, ToolHeader } from "@/components/ai-elements/tool";
import { cn } from "@/lib/utils";

type ScreenshotOutput = {
	theme?: string;
	width?: number;
	height?: number;
	url?: string;
	pngBase64?: string;
};

// The agent's look, made visible: the exact frame it judged, open by
// default. New looks carry a URL; old persisted looks keep their inline
// base64 forever.
export function ScreenshotCard({
	state,
	output,
	errorText,
	interrupted = false,
}: {
	state: ToolUIPart["state"];
	output?: ScreenshotOutput;
	errorText?: string;
	interrupted?: boolean;
}) {
	const frame =
		output?.url ??
		(output?.pngBase64 ? `data:image/png;base64,${output.pngBase64}` : null);
	return (
		<Tool defaultOpen className="bg-card">
			<ToolHeader
				type="tool-screenshot-canvas"
				state={state}
				title="Looked at the board"
				icon={<ScanEye className="size-3.5 text-muted-foreground" />}
				summary={
					<span
						className={cn(
							"font-mono text-xs",
							errorText ? "text-destructive" : "text-muted-foreground",
						)}
					>
						{headerSummary(output, errorText)}
					</span>
				}
			/>
			<ToolContent>
				<div className="border-t px-3 py-3">
					{errorText ? (
						<p className="font-mono text-xs text-destructive">{errorText}</p>
					) : frame ? (
						<Image
							src={frame}
							alt="The board exactly as Rendi sees it"
							width={output?.width ?? 1112}
							height={output?.height ?? 408}
							unoptimized
							className="h-auto w-full rounded-md border"
						/>
					) : interrupted ? (
						<p className="font-mono text-xs text-muted-foreground">
							interrupted
						</p>
					) : (
						<Shimmer className="font-mono text-xs">
							looking at the board
						</Shimmer>
					)}
				</div>
			</ToolContent>
		</Tool>
	);
}

function headerSummary(output?: ScreenshotOutput, errorText?: string): string {
	if (errorText) return "failed";
	if (!output?.url && !output?.pngBase64) return "looking";
	return `${output.width}x${output.height} · ${output.theme ?? "light"}`;
}
