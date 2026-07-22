"use client";

import type { ToolUIPart } from "ai";
import { Link2 } from "lucide-react";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Tool, ToolContent, ToolHeader } from "@/components/ai-elements/tool";
import { cn } from "@/lib/utils";

type ShareLinkOutput = { url?: string; expires_at?: string };

export function ShareLinkCard({
	state,
	output,
	errorText,
	interrupted = false,
}: {
	state: ToolUIPart["state"];
	output?: ShareLinkOutput;
	errorText?: string;
	interrupted?: boolean;
}) {
	return (
		<Tool defaultOpen className="bg-card">
			<ToolHeader
				type="tool-create-share-link"
				state={state}
				title="Created a share link"
				icon={<Link2 className="size-3.5 text-muted-foreground" />}
				summary={
					<span
						className={cn(
							"font-mono text-xs",
							errorText ? "text-destructive" : "text-muted-foreground",
						)}
					>
						{errorText ? "failed" : output?.url ? "lasts 7 days" : "working"}
					</span>
				}
			/>
			<ToolContent>
				<div className="border-t px-3 py-3">
					{errorText ? (
						<p className="font-mono text-xs text-destructive">{errorText}</p>
					) : output?.url ? (
						<a
							href={output.url}
							target="_blank"
							rel="noreferrer"
							className="block truncate font-mono text-xs text-muted-foreground underline-offset-2 hover:underline"
						>
							{output.url}
						</a>
					) : interrupted ? (
						<p className="font-mono text-xs text-muted-foreground">
							interrupted
						</p>
					) : (
						<Shimmer className="font-mono text-xs">signing the link</Shimmer>
					)}
				</div>
			</ToolContent>
		</Tool>
	);
}
