"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { Shimmer } from "@/components/ai-elements/shimmer";
import type { CanvasBlock } from "@/lib/rendi/canvas";

type ImageBlock = Extract<CanvasBlock, { kind: "image" }>;

// The block knows a prompt and a URL; storage lives behind the URL so the
// vendor is a deploy-time decision that never touches this component.
// unoptimized: assets come from whatever CDN the uploader chose, and the
// optimizer must not need a host allowlist per vendor swap.
export function ImageBlockBody({ block }: { block: ImageBlock }) {
	const host = useRef<HTMLElement>(null);
	// A generating block is as ready as it will get this render; a real
	// asset stamps on load.
	useEffect(() => {
		if (!block.assetUrl && host.current) {
			host.current.dataset.blockReady = "true";
		}
	}, [block.assetUrl]);
	const ready = () => {
		if (host.current) host.current.dataset.blockReady = "true";
	};

	return (
		<figure ref={host} className="flex h-full flex-col">
			{block.assetUrl ? (
				<div className="relative min-h-0 flex-1">
					<Image
						src={block.assetUrl}
						alt={block.prompt}
						fill
						unoptimized
						draggable={false}
						className="object-cover"
						onLoad={ready}
					/>
				</div>
			) : (
				<div className="flex min-h-0 flex-1 items-center justify-center">
					<Shimmer className="font-mono text-xs">generating</Shimmer>
				</div>
			)}
			<figcaption
				className="truncate border-t px-3 py-1.5 font-mono text-[10.5px] uppercase tracking-[0.1em] text-muted-foreground"
				title={block.prompt}
			>
				{block.prompt}
			</figcaption>
		</figure>
	);
}
