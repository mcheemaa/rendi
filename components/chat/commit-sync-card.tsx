"use client";

import type { ToolUIPart } from "ai";
import { GitCommitHorizontal } from "lucide-react";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Tool, ToolContent, ToolHeader } from "@/components/ai-elements/tool";
import { cn } from "@/lib/utils";

type SyncInput = { repos?: string[] };
type SyncOutput = { started?: boolean; repos?: string[] };

export function CommitSyncCard({
	state,
	input,
	output,
	errorText,
	interrupted = false,
}: {
	state: ToolUIPart["state"];
	input?: SyncInput;
	output?: SyncOutput;
	errorText?: string;
	interrupted?: boolean;
}) {
	const repos = output?.repos ?? input?.repos;
	return (
		<Tool defaultOpen className="bg-card">
			<ToolHeader
				type="tool-sync-commits"
				state={state}
				title="Syncing commits"
				icon={
					<GitCommitHorizontal className="size-3.5 text-muted-foreground" />
				}
				summary={
					<span
						className={cn(
							"font-mono text-xs",
							errorText ? "text-destructive" : "text-muted-foreground",
						)}
					>
						{errorText ? "failed" : (repos?.join(", ") ?? "working")}
					</span>
				}
			/>
			<ToolContent>
				<div className="border-t px-3 py-3">
					{errorText ? (
						<p className="font-mono text-xs text-destructive">{errorText}</p>
					) : output?.started ? (
						<p className="font-mono text-xs text-muted-foreground">
							pulling the latest from github, counts arrive with the wake
						</p>
					) : interrupted ? (
						<p className="font-mono text-xs text-muted-foreground">
							interrupted
						</p>
					) : (
						<Shimmer className="font-mono text-xs">reaching github</Shimmer>
					)}
				</div>
			</ToolContent>
		</Tool>
	);
}
