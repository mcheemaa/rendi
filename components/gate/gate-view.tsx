"use client";

import { useActionState } from "react";
import { RendiMark } from "@/components/brand/rendi-mark";
import { RendiWordmark } from "@/components/brand/rendi-wordmark";
import { AmbientWave } from "@/components/home/ambient-wave";
import { Hallmark } from "@/components/home/hallmark";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";

type GateAction = (
	previous: { error?: string },
	formData: FormData,
) => Promise<{ error?: string }>;

export function GateView({
	from,
	hero = "wordmark",
	action,
}: {
	from?: string;
	hero?: "wordmark" | "hallmark" | "mark";
	action: GateAction;
}) {
	const [state, submit, pending] = useActionState(action, {});

	return (
		<div className="relative flex h-full flex-col">
			<AmbientWave />
			<Empty className="relative z-[1] h-full pb-24">
				<EmptyHeader className="max-w-none">
					<EmptyMedia className="mb-3">
						{hero === "wordmark" ? (
							<RendiWordmark className="h-24 text-foreground" />
						) : hero === "mark" ? (
							<RendiMark className="h-16 text-foreground" />
						) : (
							<Hallmark />
						)}
					</EmptyMedia>
					<p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
						Private preview
					</p>
					<EmptyTitle className="font-display text-[42px] font-normal leading-tight">
						Almost there.
					</EmptyTitle>
					<EmptyDescription className="text-[15px]">
						Enter your access code to step inside.
					</EmptyDescription>
				</EmptyHeader>
				<EmptyContent className="max-w-none">
					<form action={submit} className="mt-1 flex items-center gap-2">
						<label htmlFor="gate-code" className="sr-only">
							Access code
						</label>
						<Input
							id="gate-code"
							name="code"
							autoFocus
							autoComplete="off"
							spellCheck={false}
							placeholder="access code"
							className="h-12 w-72 bg-card/75 text-center font-mono shadow-xs backdrop-blur-md"
						/>
						<input type="hidden" name="from" value={from ?? ""} />
						<Button type="submit" size="lg" className="h-12" disabled={pending}>
							{pending ? "Checking" : "Enter"}
						</Button>
					</form>
					<p aria-live="polite" className="h-5 text-sm text-destructive">
						{state.error}
					</p>
					<p className="text-[13px] text-muted-foreground">
						No code? Ask Cheema:{" "}
						<a
							href="mailto:cheemawrites@gmail.com"
							className="underline underline-offset-2 hover:text-foreground"
						>
							cheemawrites@gmail.com
						</a>
					</p>
					{hero !== "hallmark" ? <Hallmark className="mt-9" /> : null}
				</EmptyContent>
			</Empty>
		</div>
	);
}
