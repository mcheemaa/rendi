"use client";

import { useEffect, useState } from "react";

export type EmberTokens = {
	surface: string;
	ink: string;
	muted: string;
	line: string;
	accent: string;
	glow: string;
	ramp: string[];
	fontSans: string;
	fontMono: string;
};

export function readEmberTokens(): EmberTokens {
	const style = getComputedStyle(document.documentElement);
	const read = (name: string) => style.getPropertyValue(name).trim();
	return {
		surface: read("--card"),
		ink: read("--foreground"),
		muted: read("--muted-foreground"),
		line: read("--border"),
		accent: read("--primary"),
		glow: read("--glow"),
		ramp: [1, 2, 3, 4, 5, 6, 7].map((slot) => read(`--chart-${slot}`)),
		fontSans: read("--font-sans") || getComputedStyle(document.body).fontFamily,
		fontMono: read("--font-mono") || "ui-monospace, monospace",
	};
}

// Charts compile colors into their option, so a theme flip must hand them a
// fresh token object; next-themes flips the root class, which this observes.
export function useEmberTokens(): EmberTokens | null {
	const [tokens, setTokens] = useState<EmberTokens | null>(null);
	useEffect(() => {
		let last = "";
		const read = () => {
			const next = readEmberTokens();
			const key = JSON.stringify(next);
			if (key === last) return;
			last = key;
			setTokens(next);
		};
		read();
		const observer = new MutationObserver(read);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});
		return () => observer.disconnect();
	}, []);
	return tokens;
}
