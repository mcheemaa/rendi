"use client";

import { ShoppingBag } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { CartLine } from "@/components/doordash/cart-line";
import { ZoomableImage } from "@/components/doordash/zoomable-image";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DdCartLine, DdQuoteSnapshot } from "@/lib/rendi/doordash-cart";
import { cn } from "@/lib/utils";

export type CartCardData = {
	cartUuid: string;
	storeId?: string;
	storeName: string;
	storeImageUrl?: string | null;
	items: DdCartLine[];
	quote: DdQuoteSnapshot | null;
	tipCents: number;
	fulfillment: string;
	message?: string | null;
};

type CartOp =
	| { kind: "set-quantity"; lineId: string; quantity: number }
	| { kind: "remove-line"; lineId: string }
	| { kind: "set-tip"; tipCents: number }
	| { kind: "set-fulfillment"; fulfillment: "delivery" | "pickup" }
	| { kind: "preview" };

async function execOp(
	cartUuid: string,
	op: CartOp,
): Promise<{ ok?: boolean; cart?: Partial<CartCardData> | null }> {
	const response = await fetch(`/api/doordash/carts/${cartUuid}/ops`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(op),
	});
	if (!response.ok) throw new Error("edit failed");
	return response.json();
}

export type DurableCart = Partial<CartCardData> & { status?: string };

async function fetchSnapshot(cartUuid: string): Promise<DurableCart | null> {
	const response = await fetch(`/api/doordash/carts/${cartUuid}`);
	if (!response.ok) return null;
	return response.json();
}

const TIP_PRESETS = [10, 15, 20];

function dollars(cents: number): string {
	return `$${(cents / 100).toFixed(2)}`;
}

// The cart is an instrument: live truth rendered as a card, steered by
// touch without the model, and every change lands where the agent reads
// it back. exec and hydrate are injectable so stories run on fixtures.
export function CartCard({
	data,
	exec = execOp,
	hydrate = fetchSnapshot,
}: {
	data: CartCardData;
	exec?: typeof execOp;
	hydrate?: typeof fetchSnapshot;
}) {
	const [cart, setCart] = useState<CartCardData>(data);
	const [status, setStatus] = useState<string>("open");
	const [busy, setBusy] = useState(false);
	const [failed, setFailed] = useState<string | null>(null);
	// The freshest settled truth: hydration or a completed edit. A failed
	// edit rolls back here, never to the frozen transcript prop.
	const lastGood = useRef<CartCardData>(data);

	// The transcript froze this card's numbers at tool time; the cart
	// kept living. Adopt the durable snapshot so a reload, or an older
	// copy of the same cart, converges on the truth.
	useEffect(() => {
		let alive = true;
		hydrate(data.cartUuid).then((durable) => {
			if (!alive || !durable) return;
			setStatus(durable.status ?? "open");
			setCart((current) => {
				const next = {
					...current,
					...(durable.items ? { items: durable.items } : {}),
					...(durable.quote !== undefined ? { quote: durable.quote } : {}),
					...(durable.tipCents !== undefined
						? { tipCents: durable.tipCents }
						: {}),
					...(durable.fulfillment ? { fulfillment: durable.fulfillment } : {}),
				};
				lastGood.current = next;
				return next;
			});
		});
		return () => {
			alive = false;
		};
	}, [data.cartUuid, hydrate]);

	const sealed = status === "placing" || status === "placed";
	const frozen = busy || sealed;
	const subtotal = cart.quote?.ladder.find(
		(line) => line.chargeId === "SUBTOTAL",
	)?.cents;

	async function touch(op: CartOp, optimistic?: Partial<CartCardData>) {
		setFailed(null);
		setBusy(true);
		if (optimistic) setCart((current) => ({ ...current, ...optimistic }));
		try {
			const result = await exec(cart.cartUuid, op);
			if (result.cart) {
				setCart((current) => {
					const next = {
						...current,
						...(result.cart as Partial<CartCardData>),
						storeName:
							(result.cart as Partial<CartCardData>).storeName ??
							current.storeName,
					};
					lastGood.current = next;
					return next;
				});
			}
		} catch {
			setFailed("that edit did not go through; prices unchanged");
			setCart(lastGood.current);
		} finally {
			setBusy(false);
		}
	}

	if (cart.items.length === 0) {
		return (
			<Card className="my-1 bg-card py-3">
				<CardContent className="flex items-center gap-2 px-4 text-sm text-muted-foreground">
					<ShoppingBag className="size-4" aria-hidden />
					The cart is empty.
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="my-1 gap-3 bg-card py-4">
			<CardHeader className="flex flex-row items-center gap-3 px-4">
				{cart.storeImageUrl ? (
					<ZoomableImage
						src={cart.storeImageUrl}
						name={cart.storeName}
						className="size-10"
					/>
				) : null}
				<div className="min-w-0 flex-1">
					<CardTitle className="truncate font-display text-base font-normal">
						{cart.storeName}
					</CardTitle>
					<p className="font-mono text-xs text-muted-foreground">
						{sealed
							? status === "placed"
								? "ordered"
								: "placing the order"
							: cart.quote?.asapAvailable
								? (cart.quote?.etaRange ?? "")
								: "closed right now"}
					</p>
				</div>
				<ButtonGroup>
					{(["delivery", "pickup"] as const).map((mode) => (
						<Button
							key={mode}
							variant="outline"
							disabled={frozen}
							aria-pressed={cart.fulfillment === mode}
							className={cn(
								"h-7 px-2.5 text-xs capitalize",
								cart.fulfillment === mode && "bg-primary/10",
							)}
							onClick={() =>
								cart.fulfillment === mode
									? undefined
									: touch(
											{ kind: "set-fulfillment", fulfillment: mode },
											{ fulfillment: mode },
										)
							}
						>
							{mode}
						</Button>
					))}
				</ButtonGroup>
			</CardHeader>
			<CardContent className="px-4">
				<div className="divide-y">
					{cart.items.map((line) => (
						<CartLine
							key={line.lineId}
							line={line}
							busy={frozen}
							onQuantity={(lineId, quantity) =>
								touch({ kind: "set-quantity", lineId, quantity })
							}
							onRemove={(lineId) => touch({ kind: "remove-line", lineId })}
						/>
					))}
				</div>
				<div className="mt-2 flex items-center justify-between border-t pt-3">
					<p className="text-xs text-muted-foreground">Dasher tip</p>
					<ButtonGroup>
						{TIP_PRESETS.map((percent) => {
							const cents = subtotal
								? Math.round((subtotal * percent) / 100)
								: 0;
							const selected = subtotal != null && cents === cart.tipCents;
							return (
								<Button
									key={percent}
									variant="outline"
									disabled={frozen || !subtotal}
									aria-pressed={selected}
									className={cn(
										"h-7 px-2.5 font-mono text-xs",
										selected && "bg-primary/10",
									)}
									onClick={() =>
										touch(
											{ kind: "set-tip", tipCents: cents },
											{ tipCents: cents },
										)
									}
								>
									{percent}%
								</Button>
							);
						})}
					</ButtonGroup>
				</div>
				{cart.quote ? (
					<dl className="mt-3 space-y-1 border-t pt-3">
						{cart.quote.ladder.map((line) => (
							<div
								key={line.chargeId}
								className="flex items-baseline justify-between"
							>
								<dt className="text-xs text-muted-foreground">{line.label}</dt>
								<dd className="font-mono text-xs">
									{line.originalCents != null ? (
										<span className="mr-1.5 text-muted-foreground line-through">
											{dollars(line.originalCents)}
										</span>
									) : null}
									{line.displayString}
								</dd>
							</div>
						))}
						<div className="flex items-baseline justify-between">
							<dt className="text-xs text-muted-foreground">Dasher tip</dt>
							<dd className="font-mono text-xs">{dollars(cart.tipCents)}</dd>
						</div>
						{cart.quote.totalBeforeTipCents != null ? (
							<div className="flex items-baseline justify-between border-t pt-1.5">
								<dt className="text-sm">Total</dt>
								<dd
									className={cn(
										"font-mono text-sm",
										busy && "text-muted-foreground",
									)}
								>
									{busy ? (
										<Shimmer>settling</Shimmer>
									) : (
										dollars(cart.quote.totalBeforeTipCents + cart.tipCents)
									)}
								</dd>
							</div>
						) : null}
					</dl>
				) : (
					<div className="mt-3 border-t pt-3">
						<Shimmer className="font-mono text-xs">pricing the cart</Shimmer>
					</div>
				)}
				<p aria-live="polite" className="mt-2 min-h-4 text-xs text-destructive">
					{failed}
				</p>
			</CardContent>
		</Card>
	);
}
