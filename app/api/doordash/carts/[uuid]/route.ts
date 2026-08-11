import { getCartSnapshot } from "@/lib/rendi/doordash-db";

// The durable snapshot, for cards to hydrate against: transcripts
// freeze tool output forever, but the cart kept living. The uuid is
// its own capability; there is nothing guessable here.
export async function GET(
	_request: Request,
	{ params }: { params: Promise<{ uuid: string }> },
) {
	const { uuid } = await params;
	const snapshot = await getCartSnapshot(uuid);
	if (!snapshot) {
		return Response.json({ error: "no such cart" }, { status: 404 });
	}
	return Response.json({
		cartUuid: snapshot.cartUuid,
		storeName: snapshot.storeName,
		storeImageUrl: snapshot.storeImageUrl,
		items: snapshot.items,
		quote: snapshot.quote,
		tipCents: snapshot.tipCents,
		fulfillment: snapshot.fulfillment,
		status: snapshot.status,
	});
}
