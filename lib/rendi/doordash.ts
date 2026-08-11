import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { z } from "zod";
import {
	ddAddressList,
	ddItemDetails,
	ddLenient,
	ddMenuResult,
	ddOrderHistory,
	ddPaymentMethods,
	ddSearchResult,
	ddStoreDetails,
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

export async function runDd(args: string[], goal: string): Promise<unknown> {
	let stdout: string;
	try {
		({ stdout } = await run(
			cliPath(),
			["--json-output", ...args, "--intent", intentFor(goal)],
			{ timeout: TIMEOUT_MS, maxBuffer: 16 * 1024 * 1024 },
		));
	} catch (error) {
		const failure = error as {
			killed?: boolean;
			stderr?: string;
			stdout?: string;
			code?: string | number;
		};
		if (failure.killed) {
			throw new Error(`dd-cli timed out after ${TIMEOUT_MS / 1000}s`);
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
		throw new Error(detail || `dd-cli failed (${failure.code ?? "unknown"})`);
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
): Promise<z.infer<T>> {
	return schema.parse(await runDd(args, goal));
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
	return parsed(ddSearchResult, args, goal);
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
	return parsed(ddSearchResult, args, goal);
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

export async function orderReceipt(orderUuid: string, goal: string) {
	return parsed(
		ddLenient,
		["order", "receipt", "--order-uuid", orderUuid],
		goal,
	);
}

export async function addressList(goal: string) {
	return parsed(ddAddressList, ["address", "list"], goal);
}

export async function paymentMethodList(goal: string) {
	return parsed(ddPaymentMethods, ["payment-method", "list"], goal);
}
