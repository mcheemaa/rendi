"use client";

import type { ToolUIPart } from "ai";
import {
	CreditCard,
	MapPin,
	ReceiptText,
	Store,
	UtensilsCrossed,
} from "lucide-react";
import Image from "next/image";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Tool, ToolContent, ToolHeader } from "@/components/ai-elements/tool";
import type { DdMenuItem, DdStore } from "@/lib/rendi/doordash-schemas";
import { cn } from "@/lib/utils";

type Verb =
	| "search"
	| "nearby-stores"
	| "menu"
	| "store-details"
	| "item-details"
	| "find-items"
	| "order-history"
	| "order-receipt"
	| "addresses"
	| "payment-methods";

type BrowseInput = { verb?: Verb; query?: string; storeId?: string };
type BrowseOutput = {
	stores?: DdStore[];
	items?: DdMenuItem[];
	store_name?: string | null;
	item?: {
		name: string;
		description?: string | null;
		image_url?: string | null;
		price?: number | null;
		has_required_modifiers?: boolean;
		popular_modifications?: { description: string }[];
	};
	orders?: { store_name?: string | null }[];
	addresses?: unknown[];
	cards?: unknown[];
	message?: string | null;
};

const TITLES: Record<Verb, string> = {
	search: "Searched DoorDash",
	"nearby-stores": "Found nearby stores",
	menu: "Read the menu",
	"store-details": "Looked up the store",
	"item-details": "Looked at an item",
	"find-items": "Searched the aisles",
	"order-history": "Read order history",
	"order-receipt": "Pulled a receipt",
	addresses: "Read saved addresses",
	"payment-methods": "Read saved cards",
};

const ICONS: Partial<Record<Verb, typeof Store>> = {
	search: UtensilsCrossed,
	"nearby-stores": Store,
	"store-details": MapPin,
	"order-receipt": ReceiptText,
	"payment-methods": CreditCard,
};

function miles(meters?: number | null): string | null {
	if (meters == null) return null;
	return `${(meters / 1609).toFixed(1)} mi`;
}

function StoreTile({ store }: { store: DdStore }) {
	const distance = miles(store.distance_meters);
	return (
		<div className="flex items-center gap-3 rounded-lg border bg-background/60 p-2.5">
			{store.image_url ? (
				<Image
					src={store.image_url}
					alt=""
					width={56}
					height={56}
					unoptimized
					className="size-14 shrink-0 rounded-md object-cover"
				/>
			) : (
				<div className="flex size-14 shrink-0 items-center justify-center rounded-md bg-muted">
					<Store className="size-5 text-muted-foreground" aria-hidden />
				</div>
			)}
			<div className="min-w-0">
				<p className="truncate text-sm font-medium">{store.name}</p>
				<p className="font-mono text-xs text-muted-foreground">
					{[
						store.rating != null ? `${store.rating.toFixed(1)}★` : null,
						store.delivery_time,
						distance,
					]
						.filter(Boolean)
						.join(" · ")}
				</p>
				{store.printable_address ? (
					<p className="truncate text-xs text-muted-foreground">
						{store.printable_address}
					</p>
				) : null}
			</div>
		</div>
	);
}

function ItemSpotlight({ item }: { item: NonNullable<BrowseOutput["item"]> }) {
	return (
		<div className="flex items-start gap-3">
			{item.image_url ? (
				<Image
					src={item.image_url}
					alt=""
					width={72}
					height={72}
					unoptimized
					className="size-18 shrink-0 rounded-lg object-cover"
				/>
			) : null}
			<div className="min-w-0">
				<div className="flex items-baseline gap-2">
					<p className="text-sm font-medium">{item.name}</p>
					{item.price != null ? (
						<p className="font-mono text-xs text-muted-foreground">
							${item.price.toFixed(2)}
						</p>
					) : null}
				</div>
				{item.description ? (
					<p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
						{item.description}
					</p>
				) : null}
				<div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
					{item.has_required_modifiers ? (
						<span className="font-mono text-[11px] text-accent-text">
							needs choices
						</span>
					) : null}
					{item.popular_modifications?.[0] ? (
						<span className="truncate font-mono text-[11px] text-muted-foreground">
							often: {item.popular_modifications[0].description}
						</span>
					) : null}
				</div>
			</div>
		</div>
	);
}

function summarize(verb: Verb | undefined, output?: BrowseOutput): string {
	switch (verb) {
		case "search":
		case "nearby-stores":
			return `${output?.stores?.length ?? 0} stores`;
		case "menu":
			return `${output?.items?.length ?? 0} items${output?.store_name ? ` · ${output.store_name}` : ""}`;
		case "item-details":
			return output?.item?.name ?? "";
		case "order-history":
			return `${output?.orders?.length ?? 0} orders`;
		case "addresses":
			return `${output?.addresses?.length ?? 0} saved`;
		case "payment-methods":
			return `${output?.cards?.length ?? 0} on file`;
		default:
			return "";
	}
}

export function DoorDashBrowseCard({
	state,
	input,
	output,
	errorText,
	interrupted = false,
}: {
	state: ToolUIPart["state"];
	input?: BrowseInput;
	output?: BrowseOutput;
	errorText?: string;
	interrupted?: boolean;
}) {
	const verb = input?.verb;
	const Icon = (verb && ICONS[verb]) || UtensilsCrossed;
	const stores =
		verb === "search" || verb === "nearby-stores" ? (output?.stores ?? []) : [];
	return (
		<Tool defaultOpen className="bg-card">
			<ToolHeader
				type="tool-doordash-browse"
				state={state}
				title={verb ? TITLES[verb] : "Browsing DoorDash"}
				icon={<Icon className="size-3.5 text-muted-foreground" />}
				summary={
					<span
						className={cn(
							"font-mono text-xs",
							errorText ? "text-destructive" : "text-muted-foreground",
						)}
					>
						{errorText
							? "failed"
							: output
								? summarize(verb, output)
								: (input?.query ?? "")}
					</span>
				}
			/>
			<ToolContent>
				<div className="border-t px-3 py-3">
					{errorText ? (
						<p className="font-mono text-xs text-destructive">{errorText}</p>
					) : output ? (
						stores.length > 0 ? (
							<div className="grid gap-2 sm:grid-cols-2">
								{stores.map((store) => (
									<StoreTile key={store.store_id} store={store} />
								))}
							</div>
						) : verb === "item-details" && output.item ? (
							<ItemSpotlight item={output.item} />
						) : (
							<p className="font-mono text-xs text-muted-foreground">
								{output.message?.trim() ||
									`${summarize(verb, output)} · in hand`}
							</p>
						)
					) : interrupted ? (
						<p className="font-mono text-xs text-muted-foreground">
							interrupted
						</p>
					) : (
						<Shimmer className="font-mono text-xs">
							reaching DoorDash, about six seconds
						</Shimmer>
					)}
				</div>
			</ToolContent>
		</Tool>
	);
}
