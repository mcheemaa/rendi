"use client";

import { useEffect, useRef } from "react";
import { CLAUDE_MARK_D } from "@/components/home/claude-mark-d";
import {
	morphClaudePath,
	parseClaudePath,
} from "@/components/home/claude-mark-path";
import { cn } from "@/lib/utils";

const COMMANDS = parseClaudePath(CLAUDE_MARK_D);

// The official mark, alive: a quiet morph at rest, a deeper one under the
// pointer. Falls back to the static official artwork under reduced motion
// or if parsing ever fails; broken art is never an option.
export function ClaudeMark({
	amp = 1,
	className,
	pathClassName,
}: {
	amp?: number;
	className?: string;
	pathClassName?: string;
}) {
	const pathRef = useRef<SVGPathElement>(null);
	const hoverTarget = useRef(0);

	useEffect(() => {
		const reduced = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		if (reduced || !COMMANDS || !pathRef.current) return;
		const path = pathRef.current;
		let hover = 0;
		let last = performance.now();
		let raf = 0;
		const loop = (now: number) => {
			raf = requestAnimationFrame(loop);
			if (document.hidden) return;
			const dt = Math.min((now - last) / 1000, 0.1);
			last = now;
			hover += (hoverTarget.current - hover) * Math.min(1, dt / 0.45);
			const lift = amp * (1 + 1.1 * hover);
			path.setAttribute(
				"d",
				morphClaudePath(COMMANDS, now / 1000, {
					inOut: 0.011 * lift,
					turn: 0.008 * lift,
					breathe: 0.006 * lift,
				}),
			);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	}, [amp]);

	return (
		<svg
			viewBox="0 0 248 248"
			className={cn("overflow-visible", className)}
			onMouseEnter={() => {
				hoverTarget.current = 1;
			}}
			onMouseLeave={() => {
				hoverTarget.current = 0;
			}}
			aria-hidden="true"
		>
			<path ref={pathRef} d={CLAUDE_MARK_D} className={pathClassName} />
		</svg>
	);
}
