"use client";

import { Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import type { DdCartLine } from "@/lib/rendi/doordash-cart";
import { cn } from "@/lib/utils";

export function CartLine({
	line,
	busy,
	onQuantity,
	onRemove,
}: {
	line: DdCartLine;
	busy: boolean;
	onQuantity: (lineId: string, quantity: number) => void;
	onRemove: (lineId: string) => void;
}) {
	return (
		<div className="flex items-center gap-3 py-2">
			<div className="min-w-0 flex-1">
				<p className="truncate text-sm">{line.name}</p>
				{line.options.length > 0 ? (
					<p className="truncate text-xs text-muted-foreground">
						{line.options.map((option) => option.name).join(" · ")}
					</p>
				) : null}
			</div>
			{line.priceCents != null ? (
				<p className="shrink-0 font-mono text-xs text-muted-foreground">
					${((line.priceCents * line.quantity) / 100).toFixed(2)}
				</p>
			) : null}
			<ButtonGroup className={cn(busy && "opacity-60")}>
				<Button
					variant="outline"
					size="icon"
					className="size-7"
					aria-label={`One less ${line.name}`}
					disabled={busy}
					onClick={() => onQuantity(line.lineId, line.quantity - 1)}
				>
					<Minus className="size-3" />
				</Button>
				<Button
					variant="outline"
					className="h-7 min-w-8 px-2 font-mono text-xs"
					aria-label={`${line.name} quantity`}
					disabled
				>
					{line.quantity}
				</Button>
				<Button
					variant="outline"
					size="icon"
					className="size-7"
					aria-label={`One more ${line.name}`}
					disabled={busy}
					onClick={() => onQuantity(line.lineId, line.quantity + 1)}
				>
					<Plus className="size-3" />
				</Button>
			</ButtonGroup>
			<Button
				variant="ghost"
				size="icon"
				className="size-7 text-muted-foreground"
				aria-label={`Remove ${line.name}`}
				disabled={busy}
				onClick={() => onRemove(line.lineId)}
			>
				<X className="size-3.5" />
			</Button>
		</div>
	);
}
