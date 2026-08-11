"use client";

import type { ToolUIPart } from "ai";
import { KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Tool, ToolContent, ToolHeader } from "@/components/ai-elements/tool";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ApprovalOutput = {
	approvalId?: number;
	token?: string;
	expiresAt?: string;
	totalCents?: number;
	storeName?: string;
	awaiting?: string;
	denied?: string;
};

type VerifyResponse = {
	ok?: boolean;
	woke?: boolean;
	reason?: string;
	attemptsLeft?: number;
};

async function postCode(
	approvalId: number,
	code: string,
	token: string,
): Promise<VerifyResponse> {
	const response = await fetch(`/api/doordash/approvals/${approvalId}/verify`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ code, token }),
	});
	return response.json();
}

async function postCancel(approvalId: number, token: string): Promise<void> {
	await fetch(`/api/doordash/approvals/${approvalId}/cancel`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ token }),
	});
}

async function getStatus(approvalId: number, token: string): Promise<string> {
	const response = await fetch(
		`/api/doordash/approvals/${approvalId}?token=${encodeURIComponent(token)}`,
	);
	if (!response.ok) return "voided";
	const body = (await response.json()) as { status?: string };
	return body.status ?? "waiting";
}

type Phase =
	| "waiting"
	| "checking"
	| "approved"
	| "cancelled"
	| "voided"
	| "expired";

const DEAD_NOTES: Record<string, string> = {
	expired: "the code expired; ask rendi for a fresh approval",
	locked: "too many tries; this approval is dead",
	gone: "this approval is no longer live",
};

// The two-key ritual's door. The code from the owner's inbox is typed
// here and POSTs straight to the verify route; it never touches the
// model and never enters the transcript. The transcript re-renders this
// card on every reload, so it asks the row where things stand before
// offering the input again.
export function ApprovalCard({
	state,
	output,
	errorText,
	interrupted = false,
	verify = postCode,
	cancel = postCancel,
	fetchStatus = getStatus,
}: {
	state: ToolUIPart["state"];
	output?: ApprovalOutput;
	errorText?: string;
	interrupted?: boolean;
	verify?: typeof postCode;
	cancel?: typeof postCancel;
	fetchStatus?: typeof getStatus;
}) {
	const [code, setCode] = useState("");
	const [phase, setPhase] = useState<Phase>("waiting");
	const [note, setNote] = useState<string | null>(null);
	const [seconds, setSeconds] = useState<number | null>(null);

	const approvalId = output?.approvalId;
	const token = output?.token ?? "";
	const expiresAt = output?.expiresAt;

	useEffect(() => {
		if (!approvalId) return;
		let alive = true;
		fetchStatus(approvalId, token).then((status) => {
			if (!alive) return;
			if (status === "verified" || status === "consumed") {
				setPhase("approved");
			} else if (status === "voided") {
				setPhase("voided");
			} else if (status === "expired") {
				setPhase("expired");
			}
		});
		return () => {
			alive = false;
		};
	}, [approvalId, token, fetchStatus]);

	useEffect(() => {
		if (phase !== "waiting" || !expiresAt) return;
		const tick = () =>
			setSeconds(
				Math.max(0, Math.floor((Date.parse(expiresAt) - Date.now()) / 1000)),
			);
		tick();
		const timer = setInterval(tick, 1000);
		return () => clearInterval(timer);
	}, [expiresAt, phase]);

	async function submitCode() {
		if (!approvalId || code.trim().length < 6) return;
		setPhase("checking");
		setNote(null);
		const result = await verify(approvalId, code.trim(), token);
		if (result.ok) {
			setPhase("approved");
			if (result.woke === false) {
				setNote("rendi did not hear the bell; say anything in the chat");
			}
			return;
		}
		setCode("");
		if (result.reason && result.reason !== "wrong") {
			setPhase(result.reason === "expired" ? "expired" : "voided");
			setNote(DEAD_NOTES[result.reason] ?? DEAD_NOTES.gone);
			return;
		}
		setPhase("waiting");
		setNote(
			`wrong code${result.attemptsLeft != null ? `, ${result.attemptsLeft} ${result.attemptsLeft === 1 ? "try" : "tries"} left` : ""}`,
		);
	}

	const summary = errorText
		? "failed"
		: output?.denied
			? "denied"
			: output?.totalCents != null
				? `$${(output.totalCents / 100).toFixed(2)} at ${output.storeName ?? ""}`
				: "";

	return (
		<Tool defaultOpen className="bg-card">
			<ToolHeader
				type="tool-doordash-request-approval"
				state={state}
				title="Asked for the owner's yes"
				icon={<KeyRound className="size-3.5 text-muted-foreground" />}
				summary={
					<span className="font-mono text-xs text-muted-foreground">
						{summary}
					</span>
				}
			/>
			<ToolContent>
				<div className="border-t px-3 py-3">
					{errorText ? (
						<p className="font-mono text-xs text-destructive">{errorText}</p>
					) : output?.denied ? (
						<p className="font-mono text-xs text-muted-foreground">
							{output.denied}
						</p>
					) : approvalId ? (
						phase === "approved" ? (
							<div className="space-y-1">
								<p className="font-mono text-xs text-accent-text">
									approved; rendi is placing the order
								</p>
								{note ? (
									<p className="font-mono text-xs text-muted-foreground">
										{note}
									</p>
								) : null}
							</div>
						) : phase === "cancelled" ? (
							<p className="font-mono text-xs text-muted-foreground">
								approval cancelled; the cart is open again
							</p>
						) : phase === "voided" || phase === "expired" ? (
							<p className="font-mono text-xs text-muted-foreground">
								{note ?? DEAD_NOTES[phase === "expired" ? "expired" : "gone"]}
							</p>
						) : (
							<div className="space-y-2">
								<p className="text-sm">
									A one-time code is in the owner&rsquo;s inbox. Type it here;
									it never goes through the chat.
								</p>
								<div className="flex items-center gap-2">
									<Input
										value={code}
										onChange={(event) =>
											setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
										}
										onKeyDown={(event) => {
											if (event.key === "Enter") void submitCode();
										}}
										inputMode="numeric"
										autoComplete="one-time-code"
										placeholder="six digits"
										aria-label="Approval code"
										disabled={phase === "checking"}
										className="h-9 w-36 text-center font-mono tracking-[0.3em]"
									/>
									<Button
										size="sm"
										disabled={phase === "checking" || code.length < 6}
										onClick={() => void submitCode()}
									>
										{phase === "checking" ? "Checking" : "Approve"}
									</Button>
									<Button
										size="sm"
										variant="ghost"
										disabled={phase === "checking"}
										onClick={async () => {
											await cancel(approvalId, token);
											setPhase("cancelled");
										}}
									>
										Cancel
									</Button>
									{seconds != null ? (
										<span className="ml-auto font-mono text-xs text-muted-foreground">
											{seconds > 0
												? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
												: "expired"}
										</span>
									) : null}
								</div>
								<p
									aria-live="polite"
									className="min-h-4 font-mono text-xs text-destructive"
								>
									{note}
								</p>
							</div>
						)
					) : interrupted ? (
						<p className="font-mono text-xs text-muted-foreground">
							interrupted
						</p>
					) : (
						<Shimmer className="font-mono text-xs">
							pricing and sealing the cart
						</Shimmer>
					)}
				</div>
			</ToolContent>
		</Tool>
	);
}
