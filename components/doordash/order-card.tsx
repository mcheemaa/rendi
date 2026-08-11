"use client";

import type { ToolUIPart } from "ai";
import { ReceiptText } from "lucide-react";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Tool, ToolContent, ToolHeader } from "@/components/ai-elements/tool";

type OrderOutput = {
	outcome?: string;
	orderUuid?: string | null;
	totalCents?: number;
	storeName?: string;
	error?: string;
	note?: string;
	refused?: string;
	voided?: string;
};

function face(output: OrderOutput): {
	title: string;
	summary: string;
	tone: "good" | "bad" | "muted";
	lines: string[];
} {
	if (output.refused) {
		return {
			title: "Held the order",
			summary: "refused",
			tone: "muted",
			lines: [output.refused],
		};
	}
	if (output.voided) {
		return {
			title: "Held the order",
			summary: "voided",
			tone: "muted",
			lines: [output.voided],
		};
	}
	const total =
		output.totalCents != null
			? `$${(output.totalCents / 100).toFixed(2)}`
			: null;
	const where = output.storeName ?? "the store";
	switch (output.outcome) {
		case "successful":
			return {
				title: "Placed the order",
				summary: [total, where].filter(Boolean).join(" at "),
				tone: "good",
				lines: [
					`the order is in at ${where}${total ? ` for ${total}` : ""}`,
					...(output.orderUuid ? [`order ${output.orderUuid.slice(-8)}`] : []),
				],
			};
		case "pending":
			return {
				title: "Placing the order",
				summary: [total, where].filter(Boolean).join(" at "),
				tone: "muted",
				lines: [
					"DoorDash accepted the order and is still confirming",
					...(output.note ? [output.note] : []),
				],
			};
		case "action_required":
			return {
				title: "The order needs a human",
				summary: "action required",
				tone: "bad",
				lines: [
					"DoorDash wants something only the app can answer",
					...(output.error ? [output.error] : []),
					...(output.note ? [output.note] : []),
				],
			};
		case "cancelled":
			return {
				title: "The order was cancelled",
				summary: "cancelled",
				tone: "muted",
				lines: [
					`DoorDash cancelled the order at ${where}`,
					...(output.error ? [output.error] : []),
				],
			};
		case "failed":
			return {
				title: "The order failed",
				summary: "failed",
				tone: "bad",
				lines: [
					...(output.error ? [output.error] : ["DoorDash rejected the order"]),
					...(output.note ? [output.note] : []),
				],
			};
		default:
			return {
				title: "Placed the order",
				summary: output.outcome ?? "",
				tone: "muted",
				lines: [
					...(output.note ? [output.note] : []),
					...(output.error ? [output.error] : []),
				],
			};
	}
}

// The submit tool's face: the receipt moment when it lands, and an
// equally plain telling when it does not.
export function OrderCard({
	state,
	output,
	errorText,
	interrupted = false,
}: {
	state: ToolUIPart["state"];
	output?: OrderOutput;
	errorText?: string;
	interrupted?: boolean;
}) {
	const resolved = errorText
		? {
				title: "The order failed",
				summary: "failed",
				tone: "bad" as const,
				lines: [errorText],
			}
		: output
			? face(output)
			: null;

	return (
		<Tool defaultOpen className="bg-card">
			<ToolHeader
				type="tool-doordash-submit"
				state={state}
				title={resolved?.title ?? "Placing the order"}
				icon={<ReceiptText className="size-3.5 text-muted-foreground" />}
				summary={
					<span className="font-mono text-xs text-muted-foreground">
						{resolved?.summary ?? ""}
					</span>
				}
			/>
			<ToolContent>
				<div className="border-t px-3 py-3">
					{resolved ? (
						<div className="space-y-1">
							{resolved.lines.map((line, index) => (
								<p
									key={line}
									className={
										index === 0
											? resolved.tone === "good"
												? "text-sm text-accent-text"
												: resolved.tone === "bad"
													? "font-mono text-xs text-destructive"
													: "font-mono text-xs text-muted-foreground"
											: "font-mono text-xs text-muted-foreground"
									}
								>
									{line}
								</p>
							))}
						</div>
					) : interrupted ? (
						<p className="font-mono text-xs text-muted-foreground">
							interrupted
						</p>
					) : (
						<Shimmer className="font-mono text-xs">
							placing the order; confirmation can take a minute
						</Shimmer>
					)}
				</div>
			</ToolContent>
		</Tool>
	);
}
