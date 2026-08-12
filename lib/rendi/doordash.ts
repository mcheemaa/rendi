import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { z } from "zod";
import {
	ddAddressList,
	ddCartEnvelope,
	ddCartList,
	ddItemDetails,
	ddLenient,
	ddMenuResult,
	ddOrderHistory,
	ddOrderStatus,
	ddPaymentMethods,
	ddPreviewResult,
	ddSearchResult,
	ddStoreDetails,
	ddSubmitResult,
} from "./doordash-schemas.ts";

const run = promisify(execFile);

// The CLI wraps an MCP service; every --json-output response arrives as
// this envelope and the data lives in structuredContent.
type Envelope = {
	structuredContent?: unknown;
	content?: { text?: string }[];
	isError?: boolean;
};

const TIMEOUT_MS = 30_000;

// Thrown when the CLI died without answering: a timeout or transport
// failure proves nothing about whether DoorDash received the request.
// Money-moving callers must treat this as unknown, never as rejected.
export class DdUncertainError extends Error {}

function cliPath(): string {
	return process.env.DD_CLI_PATH ?? "dd-cli";
}

// Every tool-backed command requires --intent, their audit trail: who the
// workflow serves and the verbatim ask that started it, never the action.
export function intentFor(goal: string): string {
	const trimmed = goal.replace(/\s+/g, " ").trim().slice(0, 200);
	return [
		"Summary: Help the owner order food through their personal rendi assistant.",
		`user prompt/purpose: "${trimmed}"`,
	].join("\n");
}

export async function runDd(
	args: string[],
	goal: string,
	opts?: { timeoutMs?: number },
): Promise<unknown> {
	const timeoutMs = opts?.timeoutMs ?? TIMEOUT_MS;
	let stdout: string;
	try {
		({ stdout } = await run(
			cliPath(),
			["--json-output", ...args, "--intent", intentFor(goal)],
			{ timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 },
		));
	} catch (error) {
		const failure = error as {
			killed?: boolean;
			stderr?: string;
			stdout?: string;
			code?: string | number;
		};
		if (failure.killed) {
			throw new DdUncertainError(`dd-cli timed out after ${timeoutMs / 1000}s`);
		}
		if (failure.code === "ENOENT") {
			throw new Error("dd-cli is not installed; nothing was sent to DoorDash");
		}
		const detail = (failure.stderr || failure.stdout || "")
			.trim()
			.split("\n")
			.at(-1);
		if (detail?.includes("credentials")) {
			throw new Error(
				"DoorDash access token is missing or expired; mint a fresh one with dd-cli export-token (or dd-cli login on this machine).",
			);
		}
		// The process started and died without a structured answer; only an
		// isError envelope proves DoorDash actually rejected the request.
		throw new DdUncertainError(
			detail || `dd-cli failed (${failure.code ?? "unknown"})`,
		);
	}
	const envelope = JSON.parse(stdout) as Envelope;
	if (envelope.isError) {
		throw new Error(envelope.content?.[0]?.text?.trim() || "dd-cli error");
	}
	return envelope.structuredContent ?? envelope;
}

async function parsed<T extends z.ZodType>(
	schema: T,
	args: string[],
	goal: string,
	opts?: { timeoutMs?: number },
): Promise<z.infer<T>> {
	return schema.parse(await runDd(args, goal, opts));
}

// The saved default address is the CLI's own location doctrine for "near
// me" searches; memoized because addresses change on a human timescale
// and every CLI call costs ~6 seconds.
let coordsCache: { value: { lat: number; lng: number }; at: number } | null =
	null;
const COORDS_TTL_MS = 10 * 60 * 1000;

export async function defaultCoords(
	goal: string,
): Promise<{ lat: number; lng: number } | null> {
	if (coordsCache && Date.now() - coordsCache.at < COORDS_TTL_MS) {
		return coordsCache.value;
	}
	const list = await addressList(goal);
	const home = list.addresses.find((address) => address.is_default);
	if (!home) return null;
	coordsCache = { value: { lat: home.lat, lng: home.lng }, at: Date.now() };
	return coordsCache.value;
}

// dd-cli is built for a renderer with widgets; headless consumers get
// the widget's stage directions as message text ("the widget is showing
// an address picker..."). Those instructions are never addressed to us,
// so translate them into the honest fact before anyone repeats them.
function stripWidgetSpeak<
	T extends { message?: string | null; needs_address?: boolean },
>(result: T): T {
	if (result.needs_address || /widget/i.test(result.message ?? "")) {
		return {
			...result,
			message:
				"DoorDash wants a delivery-address choice here, and its address picker only exists in its own app. The account's saved addresses are the only delivery targets; search near one of them instead.",
		};
	}
	return result;
}

export async function search(
	input: { query: string; lat?: number; lng?: number; limit?: number },
	goal: string,
) {
	const coords =
		input.lat != null && input.lng != null
			? { lat: input.lat, lng: input.lng }
			: await defaultCoords(goal);
	const args = ["search", "--query", input.query];
	if (coords)
		args.push("--lat", String(coords.lat), "--lng", String(coords.lng));
	if (input.limit) args.push("--limit", String(input.limit));
	return stripWidgetSpeak(await parsed(ddSearchResult, args, goal));
}

export async function findNearbyStores(
	input: { vertical?: string; max?: number; lat?: number; lng?: number },
	goal: string,
) {
	const args = ["find-nearby-stores"];
	if (input.vertical) args.push("--vertical", input.vertical);
	if (input.max) args.push("--max", String(input.max));
	if (input.lat != null && input.lng != null) {
		args.push("--lat", String(input.lat), "--lng", String(input.lng));
	}
	return stripWidgetSpeak(await parsed(ddSearchResult, args, goal));
}

export async function storeDetails(storeId: string, goal: string) {
	return parsed(ddStoreDetails, ["store-details", "--store-id", storeId], goal);
}

export async function menu(storeId: string, goal: string) {
	return parsed(ddMenuResult, ["menu", "--store-id", storeId], goal);
}

export async function restaurantItemDetails(
	input: { storeId: string; menuId: string; itemId: string },
	goal: string,
) {
	return parsed(
		ddItemDetails,
		[
			"restaurant-item-details",
			"--store-id",
			input.storeId,
			"--menu-id",
			input.menuId,
			// The menu lists ids as i_123...; the details command wants them bare.
			"--item-id",
			input.itemId.replace(/^i_/, ""),
		],
		goal,
	);
}

export async function itemDetails(
	input: { storeId: string; itemId: string },
	goal: string,
) {
	return parsed(
		ddItemDetails,
		["item-details", "--store-id", input.storeId, "--item-id", input.itemId],
		goal,
	);
}

export async function findItems(
	input: { storeId: string; queries: string[] },
	goal: string,
) {
	const args = ["find-items", "--store-id", input.storeId];
	for (const query of input.queries) args.push("--query", query);
	return parsed(ddLenient, args, goal);
}

export async function orderHistory(
	input: { max?: number; days?: number },
	goal: string,
) {
	const args = ["order", "history"];
	if (input.max) args.push("--max", String(input.max));
	if (input.days) args.push("--days", String(input.days));
	return parsed(ddOrderHistory, args, goal);
}

// After an uncertain submit, order history is the truth, but only when
// it actually answers: an unreachable history proves nothing, and
// conflating it with an empty one is how a live order gets orphaned.
export type OrderReconciliation =
	| { found: string | null }
	| { unavailable: true };

export async function findUnrecordedOrder(
	storeId: string,
	known: Set<string>,
	goal: string,
): Promise<OrderReconciliation> {
	const history = await orderHistory({ max: 5, days: 1 }, goal).catch(
		() => null,
	);
	if (!history) return { unavailable: true };
	const found = history.orders.find(
		(order) =>
			String(order.store_id ?? "") === storeId && !known.has(order.order_uuid),
	);
	return { found: found?.order_uuid ?? null };
}

export async function orderReceipt(orderUuid: string, goal: string) {
	return parsed(
		ddLenient,
		["order", "receipt", "--order-uuid", orderUuid],
		goal,
	);
}

export type DdNewCartItem = {
	item_id: string;
	item_name: string;
	quantity: number;
	nested_options?: {
		id: string;
		name: string;
		quantity: number;
		options?: DdNewCartItem["nested_options"];
	}[];
};

export async function cartList(goal: string, storeId?: string) {
	const args = ["cart", "list"];
	if (storeId) args.push("--store-id", storeId);
	return parsed(ddCartList, args, goal);
}

export async function cartAddItems(
	input: {
		storeId: string;
		menuId: string;
		items: DdNewCartItem[];
		cartUuid?: string;
		fulfillment?: "delivery" | "pickup";
	},
	goal: string,
) {
	const args = [
		"cart",
		"add-items",
		"--store-id",
		input.storeId,
		"--menu-id",
		input.menuId,
		"--items-json",
		JSON.stringify(
			// The menu lists ids as i_123...; the cart wants them bare.
			input.items.map((item) => ({
				...item,
				item_id: item.item_id.replace(/^i_/, ""),
			})),
		),
	];
	if (input.cartUuid) args.push("--cart-uuid", input.cartUuid);
	if (input.fulfillment) args.push("--fulfillment", input.fulfillment);
	return parsed(ddCartEnvelope, args, goal);
}

export async function cartShow(cartUuid: string, goal: string) {
	return parsed(
		ddCartEnvelope,
		["cart", "show", "--cart-uuid", cartUuid],
		goal,
	);
}

export async function cartRemoveItem(
	input: { cartUuid: string; cartItemId: string },
	goal: string,
) {
	return parsed(
		ddCartEnvelope,
		[
			"cart",
			"remove-item",
			"--cart-uuid",
			input.cartUuid,
			"--cart-item-id",
			input.cartItemId,
		],
		goal,
	);
}

export async function cartDelete(cartUuid: string, goal: string) {
	return parsed(
		ddCartEnvelope,
		["cart", "delete", "--cart-uuid", cartUuid],
		goal,
	);
}

export async function orderPreview(
	input: {
		cartUuid: string;
		fulfillment?: "delivery" | "pickup";
		scheduledTime?: string;
		priority?: boolean;
	},
	goal: string,
) {
	const args = ["order", "preview", "--cart-uuid", input.cartUuid];
	// Passing --fulfillment FLIPS the cart's stored mode; callers treat
	// that as a write, never a read.
	if (input.fulfillment) args.push("--fulfillment", input.fulfillment);
	if (input.scheduledTime) args.push("--scheduled-time", input.scheduledTime);
	if (input.priority) args.push("--priority");
	return parsed(ddPreviewResult, args, goal);
}

export async function promoApply(
	input: {
		cartUuid: string;
		promoCode: string;
		campaignId?: string;
		adGroupId?: string;
		adId?: string;
	},
	goal: string,
) {
	const args = [
		"promo",
		"apply",
		"--cart-uuid",
		input.cartUuid,
		"--promo-code",
		input.promoCode,
	];
	if (input.campaignId) args.push("--campaign-id", input.campaignId);
	if (input.adGroupId) args.push("--ad-group-id", input.adGroupId);
	if (input.adId) args.push("--ad-id", input.adId);
	return parsed(ddLenient, args, goal);
}

export async function promoList(storeId: string, goal: string) {
	return parsed(ddLenient, ["promo", "list", "--store-id", storeId], goal);
}

// DESTRUCTIVE: charges the default payment method immediately, and their
// API has no idempotency. Only the submit tool calls this, and only by
// consuming a verified single-use approval first.
export async function orderSubmit(
	input: {
		cartUuid: string;
		tipCents: number;
		fulfillment?: string;
		scheduledTime?: string;
		priority?: boolean;
	},
	goal: string,
) {
	const args = [
		"order",
		"submit",
		"--cart-uuid",
		input.cartUuid,
		"--tip-cents",
		String(input.tipCents),
		// A headless worker has no keypress to give: without --yes the CLI
		// waits on its interactive confirmation forever. The human yes
		// already happened, in the owner's inbox.
		"--yes",
	];
	if (input.fulfillment) args.push("--fulfillment", input.fulfillment);
	if (input.scheduledTime) args.push("--scheduled-time", input.scheduledTime);
	if (input.priority) args.push("--priority");
	// Payment authorization is the CLI's slowest call; the read-call
	// timeout starved it during the first ceremony.
	return parsed(ddSubmitResult, args, goal, { timeoutMs: 120_000 });
}

export async function orderStatus(orderUuid: string, goal: string) {
	return parsed(
		ddOrderStatus,
		["order", "status", "--order-uuid", orderUuid],
		goal,
	);
}

export async function addressList(goal: string) {
	return parsed(ddAddressList, ["address", "list"], goal);
}

export async function paymentMethodList(goal: string) {
	return parsed(ddPaymentMethods, ["payment-method", "list"], goal);
}
