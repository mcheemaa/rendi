import { eq } from "drizzle-orm";
import { getDb } from "../db/index.ts";
import { type DdCartRow, ddCarts } from "../db/schema.ts";
import type {
	DdCartLine,
	DdCartStatus,
	DdQuoteSnapshot,
} from "./doordash-cart.ts";

// The single writer for cart render snapshots. DoorDash stays the source
// of truth; these rows are what cards paint from, instantly and forever.

export async function upsertCartSnapshot(snapshot: {
	cartUuid: string;
	conversationId: string;
	storeId: string;
	storeName: string;
	storeImageUrl?: string | null;
	items: DdCartLine[];
	quote?: DdQuoteSnapshot | null;
	fulfillment?: string;
	tipCents?: number;
	status?: DdCartStatus;
}): Promise<void> {
	const patch = {
		items: snapshot.items,
		...(snapshot.quote !== undefined ? { quote: snapshot.quote } : {}),
		...(snapshot.fulfillment ? { fulfillment: snapshot.fulfillment } : {}),
		...(snapshot.tipCents !== undefined ? { tipCents: snapshot.tipCents } : {}),
		...(snapshot.status ? { status: snapshot.status } : {}),
		updatedAt: new Date(),
	};
	await getDb()
		.insert(ddCarts)
		.values({
			cartUuid: snapshot.cartUuid,
			conversationId: snapshot.conversationId,
			storeId: snapshot.storeId,
			storeName: snapshot.storeName,
			storeImageUrl: snapshot.storeImageUrl ?? null,
			items: snapshot.items,
			quote: snapshot.quote ?? null,
			fulfillment: snapshot.fulfillment ?? "delivery",
			tipCents: snapshot.tipCents ?? 0,
			status: snapshot.status ?? "open",
		})
		.onConflictDoUpdate({ target: ddCarts.cartUuid, set: patch });
}

export async function getCartSnapshot(
	cartUuid: string,
): Promise<DdCartRow | undefined> {
	const rows = await getDb()
		.select()
		.from(ddCarts)
		.where(eq(ddCarts.cartUuid, cartUuid))
		.limit(1);
	return rows[0];
}

export async function setCartStatus(
	cartUuid: string,
	status: DdCartStatus,
): Promise<void> {
	await getDb()
		.update(ddCarts)
		.set({ status, updatedAt: new Date() })
		.where(eq(ddCarts.cartUuid, cartUuid));
}

export async function setCartTip(
	cartUuid: string,
	tipCents: number,
): Promise<void> {
	await getDb()
		.update(ddCarts)
		.set({ tipCents, updatedAt: new Date() })
		.where(eq(ddCarts.cartUuid, cartUuid));
}
