"use client";

import type { ToolUIPart } from "ai";
import { ShoppingBag } from "lucide-react";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Tool, ToolContent, ToolHeader } from "@/components/ai-elements/tool";
import { CartCard, type CartCardData } from "@/components/doordash/cart-card";

type CartToolOutput = Partial<CartCardData> & {
	existingCart?: {
		cartUuid?: string | null;
		storeName?: string | null;
		itemsCount?: number | null;
	};
	needsChoices?: boolean;
	itemErrors?: {
		item_name?: string | null;
		required_options?: {
			name?: string | null;
			options?: { name?: string | null }[];
		}[];
	}[];
	deleted?: boolean;
	tipCents?: number;
};

function Quiet({
	state,
	summary,
	children,
}: {
	state: ToolUIPart["state"];
	summary: string;
	children: React.ReactNode;
}) {
	return (
		<Tool defaultOpen className="bg-card">
			<ToolHeader
				type="tool-doordash-cart"
				state={state}
				title="Touched the cart"
				icon={<ShoppingBag className="size-3.5 text-muted-foreground" />}
				summary={
					<span className="font-mono text-xs text-muted-foreground">
						{summary}
					</span>
				}
			/>
			<ToolContent>
				<div className="border-t px-3 py-3">{children}</div>
			</ToolContent>
		</Tool>
	);
}

export function CartToolCard({
	state,
	output,
	errorText,
	interrupted = false,
}: {
	state: ToolUIPart["state"];
	output?: CartToolOutput;
	errorText?: string;
	interrupted?: boolean;
}) {
	if (errorText) {
		return (
			<Quiet state={state} summary="failed">
				<p className="font-mono text-xs text-destructive">{errorText}</p>
			</Quiet>
		);
	}
	if (!output) {
		return (
			<Quiet state={state} summary="">
				{interrupted ? (
					<p className="font-mono text-xs text-muted-foreground">interrupted</p>
				) : (
					<Shimmer className="font-mono text-xs">
						reaching DoorDash, up to fifteen seconds
					</Shimmer>
				)}
			</Quiet>
		);
	}
	if (output.deleted) {
		return (
			<Quiet state={state} summary="cart deleted">
				<p className="font-mono text-xs text-muted-foreground">
					nothing left to order from that cart
				</p>
			</Quiet>
		);
	}
	if (output.existingCart) {
		return (
			<Quiet
				state={state}
				summary={output.existingCart.storeName ?? "existing cart"}
			>
				<p className="font-mono text-xs text-muted-foreground">
					an open cart already exists at {output.existingCart.storeName}
					{output.existingCart.itemsCount
						? ` with ${output.existingCart.itemsCount} item${output.existingCart.itemsCount === 1 ? "" : "s"}`
						: ""}
					; rendi is asking whether to extend or replace it
				</p>
			</Quiet>
		);
	}
	if (output.needsChoices) {
		return (
			<Quiet state={state} summary="needs choices">
				<div className="space-y-2">
					{(output.itemErrors ?? []).map((item, index) => (
						<div key={item.item_name ?? index}>
							<p className="text-sm">{item.item_name}</p>
							{(item.required_options ?? []).map((group) => (
								<p
									key={group.name}
									className="font-mono text-xs text-muted-foreground"
								>
									{group.name}:{" "}
									{(group.options ?? [])
										.map((option) => option.name)
										.filter(Boolean)
										.join(" / ")}
								</p>
							))}
						</div>
					))}
					<p className="font-mono text-xs text-accent-text">
						tell rendi which, and it will add the item
					</p>
				</div>
			</Quiet>
		);
	}
	if (output.cartUuid && output.items) {
		return <CartCard data={output as CartCardData} />;
	}
	if (output.cartUuid && output.tipCents !== undefined) {
		return (
			<Quiet state={state} summary={`tip set`}>
				<p className="font-mono text-xs text-muted-foreground">
					dasher tip is now ${(output.tipCents / 100).toFixed(2)}
				</p>
			</Quiet>
		);
	}
	return null;
}
