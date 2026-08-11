import { task } from "@trigger.dev/sdk";
import {
	type CartOpResult,
	opPreview,
	opRemoveLine,
	opSetQuantity,
	opSetTip,
} from "@/lib/rendi/doordash-ops";

// The UI's hand on a cart. The binary lives in the worker, not on the
// app host, so every touch edit rides one task invocation: mutate at
// DoorDash, re-preview, upsert the snapshot the card adopts.

export type CartExecPayload = {
	cartUuid: string;
	conversationId: string;
	op:
		| { kind: "set-quantity"; lineId: string; quantity: number }
		| { kind: "remove-line"; lineId: string }
		| { kind: "set-tip"; tipCents: number }
		| { kind: "set-fulfillment"; fulfillment: "delivery" | "pickup" }
		| { kind: "preview" };
};

const TOUCH_GOAL = "owner adjusted the cart by hand in the rendi UI";

export const ddCartExec = task({
	id: "rendi-dd-cart-exec",
	maxDuration: 120,
	queue: { concurrencyLimit: 1 },
	run: async (
		payload: CartExecPayload,
	): Promise<CartOpResult | { cartUuid: string; tipCents: number }> => {
		const { cartUuid, conversationId, op } = payload;
		switch (op.kind) {
			case "set-quantity":
				return opSetQuantity({
					conversationId,
					goal: TOUCH_GOAL,
					cartUuid,
					lineId: op.lineId,
					quantity: op.quantity,
				});
			case "remove-line":
				return opRemoveLine({
					conversationId,
					goal: TOUCH_GOAL,
					cartUuid,
					lineId: op.lineId,
				});
			case "set-tip":
				return opSetTip({ cartUuid, tipCents: op.tipCents });
			case "set-fulfillment":
				return opPreview({
					conversationId,
					goal: TOUCH_GOAL,
					cartUuid,
					fulfillment: op.fulfillment,
				});
			case "preview":
				return opPreview({ conversationId, goal: TOUCH_GOAL, cartUuid });
		}
	},
});
