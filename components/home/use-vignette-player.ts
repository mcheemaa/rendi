"use client";

import { useEffect, useRef, useState } from "react";

const PHASES = [
	"typing",
	"answer",
	"bars",
	"stat",
	"approach",
	"settle",
	"release",
	"beat",
	"ticked",
	"rest",
] as const;

export type VignettePhase = (typeof PHASES)[number];

export function phaseReached(
	current: VignettePhase,
	target: VignettePhase,
): boolean {
	return PHASES.indexOf(current) >= PHASES.indexOf(target);
}

const TIMELINE: ReadonlyArray<readonly [VignettePhase, number]> = [
	["answer", 1600],
	["bars", 3400],
	["stat", 4300],
	["approach", 5400],
	["settle", 6500],
	["release", 7800],
	["beat", 10600],
	["ticked", 12400],
	["rest", 14200],
];
const TYPE_MS = 40;
// Alive when watched, calm always: one full cycle, a long rest, replay only
// while the tab is visible, and a short settle before replaying on return.
const REPLAY_MS = 28_000;
const RETURN_MS = 6_000;

export function useVignettePlayer(question: string): {
	phase: VignettePhase;
	text: string;
	animate: boolean;
} {
	const [phase, setPhase] = useState<VignettePhase>("typing");
	const [text, setText] = useState("");
	const [animate, setAnimate] = useState(true);
	const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

	useEffect(() => {
		const reduced = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;
		if (reduced) {
			setAnimate(false);
			setPhase("rest");
			setText(question);
			return;
		}

		const schedule = (fn: () => void, ms: number) => {
			timers.current.push(setTimeout(fn, ms));
		};
		const clearAll = () => {
			for (const timer of timers.current.splice(0)) clearTimeout(timer);
		};
		const play = () => {
			clearAll();
			setPhase("typing");
			setText("");
			for (let i = 1; i <= question.length; i++) {
				schedule(() => setText(question.slice(0, i)), i * TYPE_MS);
			}
			for (const [next, at] of TIMELINE) schedule(() => setPhase(next), at);
			schedule(play, REPLAY_MS);
		};
		const onVisibility = () => {
			if (document.hidden) {
				clearAll();
				setPhase("rest");
				setText(question);
			} else {
				schedule(play, RETURN_MS);
			}
		};

		document.addEventListener("visibilitychange", onVisibility);
		play();
		return () => {
			document.removeEventListener("visibilitychange", onVisibility);
			clearAll();
		};
	}, [question]);

	return { phase, text, animate };
}
