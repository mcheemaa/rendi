"use client";

import type { ToolUIPart } from "ai";
import { Mail } from "lucide-react";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Tool, ToolContent, ToolHeader } from "@/components/ai-elements/tool";
import { cn } from "@/lib/utils";

type EmailInput = { to?: string; subject?: string };
type EmailOutput = { sent?: boolean; to?: string; subject?: string };

export function EmailCard({
	state,
	input,
	output,
	errorText,
	interrupted = false,
}: {
	state: ToolUIPart["state"];
	input?: EmailInput;
	output?: EmailOutput;
	errorText?: string;
	interrupted?: boolean;
}) {
	const to = output?.to ?? input?.to;
	const subject = output?.subject ?? input?.subject;
	return (
		<Tool defaultOpen className="bg-card">
			<ToolHeader
				type="tool-send-email"
				state={state}
				title="Sent an email"
				icon={<Mail className="size-3.5 text-muted-foreground" />}
				summary={
					<span
						className={cn(
							"font-mono text-xs",
							errorText ? "text-destructive" : "text-muted-foreground",
						)}
					>
						{errorText ? "failed" : (to ?? "writing")}
					</span>
				}
			/>
			<ToolContent>
				<div className="border-t px-3 py-3">
					{errorText ? (
						<p className="font-mono text-xs text-destructive">{errorText}</p>
					) : output?.sent ? (
						<div className="space-y-1 text-xs">
							<p className="font-medium">{subject}</p>
							<p className="font-mono text-muted-foreground">to {to}</p>
						</div>
					) : interrupted ? (
						<p className="font-mono text-xs text-muted-foreground">
							interrupted
						</p>
					) : (
						<Shimmer className="font-mono text-xs">writing the email</Shimmer>
					)}
				</div>
			</ToolContent>
		</Tool>
	);
}
