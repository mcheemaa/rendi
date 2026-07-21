"use client";

import type { ToolUIPart } from "ai";
import { ImageIcon } from "lucide-react";
import Image from "next/image";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Tool, ToolContent, ToolHeader } from "@/components/ai-elements/tool";
import { cn } from "@/lib/utils";

type ImageOutput = {
	image_id?: string;
	url?: string;
	width?: number;
	height?: number;
};

type ImageInput = {
	prompt?: string;
	source_image_id?: string;
};

// Open by default: the image IS the content. The card carries the URL;
// bytes stay behind the images route.
export function ImageCard({
	state,
	input,
	output,
	errorText,
	interrupted = false,
}: {
	state: ToolUIPart["state"];
	input?: ImageInput;
	output?: ImageOutput;
	errorText?: string;
	interrupted?: boolean;
}) {
	const refining = Boolean(input?.source_image_id);
	return (
		<Tool defaultOpen className="bg-card">
			<ToolHeader
				type="tool-generate-image"
				state={state}
				title={refining ? "Refined an image" : "Made an image"}
				icon={<ImageIcon className="size-3.5 text-muted-foreground" />}
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
					) : output?.url ? (
						<figure>
							<Image
								src={output.url}
								alt={input?.prompt ?? "Image Rendi made"}
								width={output.width ?? 1024}
								height={output.height ?? 768}
								unoptimized
								className="h-auto w-full rounded-md border"
							/>
							{input?.prompt ? (
								<figcaption className="mt-2 line-clamp-2 font-mono text-xs text-muted-foreground">
									{input.prompt}
								</figcaption>
							) : null}
						</figure>
					) : interrupted ? (
						<p className="font-mono text-xs text-muted-foreground">
							interrupted
						</p>
					) : (
						<Shimmer className="font-mono text-xs">
							{refining ? "refining the image" : "making an image"}
						</Shimmer>
					)}
				</div>
			</ToolContent>
		</Tool>
	);
}

function headerSummary(output?: ImageOutput, errorText?: string): string {
	if (errorText) return "failed";
	if (!output?.url) return "making";
	return `${output.width}x${output.height}`;
}
