"use client";

import { useEffect, useMemo, useRef } from "react";
import type { CanvasBlock } from "@/lib/rendi/canvas";
import { useEmberTokens } from "@/lib/rendi/charts/tokens";

type HtmlBlock = Extract<CanvasBlock, { kind: "html" }>;

// Agent-authored HTML runs in an iframe srcdoc with sandbox="allow-scripts"
// and NO allow-same-origin: an opaque origin that can never reach our DOM,
// cookies, or storage. The CSP meta inside the srcdoc cuts the network
// (connect-src falls back to default-src 'none'), leaving our fonts and
// https images as the only loads: a deliberate fidelity-over-purity call,
// since agent pages keep real imagery while the opaque origin keeps them
// harmless.

const TOKEN_NAMES = [
	"--background",
	"--foreground",
	"--card",
	"--card-foreground",
	"--primary",
	"--primary-foreground",
	"--secondary",
	"--muted",
	"--muted-foreground",
	"--accent",
	"--accent-text",
	"--border",
	"--ring",
	"--live",
	"--glow",
	"--radius",
	"--chart-1",
	"--chart-2",
	"--chart-3",
	"--chart-4",
	"--chart-5",
	"--chart-6",
	"--chart-7",
	"--font-sans",
	"--font-display",
	"--font-mono",
];

// script-src carries our own origin so the frame can load vendored
// libraries (public/vendor/, today D3); srcdoc runs on an opaque origin
// where 'self' matches nothing, so the origin is spelled out. The <base>
// tag pins relative URL resolution to us across browsers.
function buildCsp(origin: string): string {
	return [
		"default-src 'none'",
		"style-src 'unsafe-inline' https://fonts.googleapis.com",
		"font-src https://fonts.gstatic.com",
		`script-src 'unsafe-inline' ${origin}`,
		`img-src data: https:${process.env.NODE_ENV === "development" ? " http://localhost:3000" : ""}`,
	].join("; ");
}

function buildSrcdoc(html: string): string {
	const style = getComputedStyle(document.documentElement);
	const tokens = TOKEN_NAMES.map(
		(name) => `${name}: ${style.getPropertyValue(name).trim()};`,
	).join("\n");
	return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="${buildCsp(window.location.origin)}">
<base href="${window.location.origin}/">
<style>
@import url('https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500&family=Instrument+Sans:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap');
:root { ${tokens} }
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; }
body {
	background: var(--card);
	color: var(--foreground);
	font-family: var(--font-sans);
	font-size: 13px;
	line-height: 1.5;
	-webkit-font-smoothing: antialiased;
}
</style>
</head>
<body>${html}</body>
</html>`;
}

export function HtmlBlockBody({
	block,
	selected,
}: {
	block: HtmlBlock;
	selected: boolean;
}) {
	// Token identity changes on theme flip; the srcdoc rebuild re-themes the
	// frame. Script state inside resets, a documented v1 tradeoff.
	const tokens = useEmberTokens();
	const host = useRef<HTMLDivElement>(null);
	const srcdoc = useMemo(
		() => (tokens ? buildSrcdoc(block.html) : undefined),
		[block.html, tokens],
	);

	useEffect(() => {
		if (srcdoc && host.current) host.current.dataset.blockReady = "true";
	}, [srcdoc]);

	return (
		<div ref={host} className="flex h-full flex-col">
			<div className="flex shrink-0 items-center justify-between gap-2 border-b px-3 py-2">
				<span className="truncate font-display text-sm leading-none">
					{block.title}
				</span>
				<span className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
					sandboxed
				</span>
			</div>
			<div className="relative min-h-0 flex-1">
				{srcdoc ? (
					<iframe
						srcDoc={srcdoc}
						sandbox="allow-scripts"
						title={block.title}
						loading="lazy"
						// A drag crossing the frame must never lose its pointer
						// stream; the board sets data-dragging for the duration.
						className="h-full w-full group-data-[dragging]/board:pointer-events-none"
					/>
				) : null}
				{selected ? null : (
					// The Miro convention: first click selects through the veil,
					// selecting removes it and the content becomes interactive.
					<div className="absolute inset-0" />
				)}
			</div>
		</div>
	);
}
