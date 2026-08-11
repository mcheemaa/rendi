import { tool } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db/index";
import { conversations } from "@/lib/db/schema";
import {
	approvalToken,
	checkCaps,
	createApproval,
	hashCart,
	totalWithTip,
	voidApproval,
} from "@/lib/rendi/doordash-approval";
import { setCartStatus } from "@/lib/rendi/doordash-db";
import { sendApprovalEmail } from "@/lib/rendi/doordash-email";
import { opPreview, opSetTip } from "@/lib/rendi/doordash-ops";
import { turnContext } from "@/lib/rendi/harness/telemetry";

// The money gate's first half. Re-previews for the authoritative quote,
// enforces the caps, freezes the cart into a hash, and mails a one-time
// code to the owner's inbox and nowhere else. The code never enters the
// transcript; the model never sees it.
export const doordashRequestApproval = tool({
	description:
		"Ask the owner to approve placing this cart as a real order. Re-prices the cart, checks the spend caps, and emails a one-time code to the owner's inbox; the order card grows a code input. After calling this, tell the user a code is on its way to the owner and END YOUR TURN. When the code is entered, an [order approved] message wakes you; call doordash-submit with that approval id. Never ask anyone to say the code in chat.",
	inputSchema: z.object({
		goal: z.string().describe("The user's ask behind this order, verbatim"),
		cartUuid: z.string(),
		tipCents: z
			.number()
			.int()
			.min(0)
			.optional()
			.describe("Confirm or set the tip; omitted keeps the cart's tip"),
	}),
	execute: async ({ goal, cartUuid, tipCents }) => {
		const conversationId = turnContext()?.conversationId ?? "";
		// Fresh preview first: the approval binds to what the money IS,
		// never to what it was.
		const priced = await opPreview({ conversationId, goal, cartUuid });
		if (tipCents !== undefined && tipCents !== priced.tipCents) {
			// Persist the override so the card, the email, and the frozen
			// approval all tell one tip.
			await opSetTip({ cartUuid, tipCents });
			priced.tipCents = tipCents;
		}
		if (!priced.quote || priced.quote.totalBeforeTipCents == null) {
			return { denied: "the cart would not price; it cannot be approved" };
		}
		if (!priced.quote.asapAvailable && priced.fulfillment === "delivery") {
			return {
				denied:
					"the store is not delivering right now; approval waits until it is",
			};
		}
		if (
			priced.fulfillment === "pickup" &&
			priced.quote.pickupAvailable === false
		) {
			return {
				denied:
					"the store is not taking pickup orders right now; approval waits until it is",
			};
		}
		const totalCents = totalWithTip(priced.quote, priced.tipCents);
		if (totalCents == null) {
			return { denied: "the cart would not price; it cannot be approved" };
		}
		const capped = await checkCaps(totalCents, conversationId);
		if (capped) return capped;
		const cartHash = hashCart({
			items: priced.items,
			totalCents,
			tipCents: priced.tipCents,
			fulfillment: priced.fulfillment,
		});
		const approval = await createApproval({
			conversationId,
			cartUuid,
			cartHash,
			totalCents,
			tipCents: priced.tipCents,
		});
		const [conversation] = await getDb()
			.select({ title: conversations.title })
			.from(conversations)
			.where(eq(conversations.id, conversationId));
		try {
			await sendApprovalEmail({
				code: approval.code,
				storeName: priced.storeName,
				itemsCount: priced.items.reduce((sum, line) => sum + line.quantity, 0),
				totalDisplay: `$${(totalCents / 100).toFixed(2)}`,
				destination:
					priced.fulfillment === "pickup" ? "pickup" : "the saved address",
				conversationTitle: conversation?.title ?? "a conversation",
				minutes: 15,
				approvalId: approval.id,
			});
		} catch {
			// An approval whose code nobody received must not stay live. It
			// still counts toward the rate caps: excluding voided rows would
			// let re-requests reset the meter, which is the attack.
			await voidApproval(approval.id);
			return { denied: "the code email would not send; nothing is pending" };
		}
		await setCartStatus(cartUuid, "awaiting_code");
		return {
			approvalId: approval.id,
			token: approvalToken(approval.id),
			expiresAt: approval.expiresAt.toISOString(),
			totalCents,
			tipCents: priced.tipCents,
			storeName: priced.storeName,
			itemsCount: priced.items.length,
			awaiting: "a one-time code is in the owner's inbox",
		};
	},
});
