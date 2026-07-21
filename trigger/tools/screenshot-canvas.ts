import { tool } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { images } from "@/lib/db/schema";
import { appBase } from "@/lib/rendi/app-url";
import { turnContext } from "@/lib/rendi/harness/telemetry";
import { mintRenderToken } from "@/lib/rendi/render-token";

const READY_TIMEOUT_MS = 20_000;

export const screenshotCanvas = tool({
	description:
		"Look at this conversation's canvas with your own eyes: a rendered picture of the board exactly as the user sees it, for judging balance, crowding, overlap, and whether the composition reads well. Use it after composing or rearranging; at most two looks per request.",
	inputSchema: z.object({
		theme: z
			.enum(["light", "dark"])
			.default("light")
			.describe("Render theme; match what you are judging"),
	}),
	execute: async ({ theme }) => {
		const turn = turnContext();
		if (!turn) throw new Error("screenshot-canvas outside a turn");
		const origin = appBase();
		const token = mintRenderToken(turn.conversationId);
		const url = `${origin}/internal/canvas/${turn.conversationId}/render?token=${token}&theme=${theme}`;

		// Imported at call time so the task bundle stays lean until the agent
		// actually looks.
		const { chromium } = await import("playwright");
		const browser = await chromium.launch();
		try {
			const page = await browser.newPage({
				viewport: { width: 1600, height: 1200 },
				deviceScaleFactor: 1,
			});
			await page.goto(url, { waitUntil: "networkidle" });
			// Never a sleep: fonts plus every block's own ready stamp.
			await page.waitForFunction(
				() => {
					const root = document.querySelector("[data-render-root]");
					if (!root) return false;
					const expected = Number(root.getAttribute("data-expected") ?? "0");
					const ready = document.querySelectorAll(
						'[data-block-ready="true"]',
					).length;
					return document.fonts.status === "loaded" && ready >= expected;
				},
				{ timeout: READY_TIMEOUT_MS },
			);
			const frame = page.locator("[data-render-root]");
			const png = await frame.screenshot({ type: "png" });
			const box = await frame.boundingBox();
			const width = Math.round(box?.width ?? 0);
			const height = Math.round(box?.height ?? 0);
			const id = crypto.randomUUID();
			await getDb()
				.insert(images)
				.values({
					id,
					conversationId: turn.conversationId,
					kind: "look",
					prompt: `board look, ${theme}, ${width}x${height}`,
					mime: "image/png",
					data: png.toString("base64"),
					width,
					height,
				});
			return {
				looked: true,
				theme,
				width,
				height,
				image_id: id,
				url: `${appBase()}/api/images/${id}`,
			};
		} finally {
			await browser.close();
		}
	},
	// Old persisted parts carry inline base64; new ones re-read from the
	// images table so message payloads stay URL-small.
	toModelOutput: async ({ output }) => {
		const legacy = output as typeof output & { pngBase64?: string };
		let data = legacy.pngBase64;
		if (!data && output.image_id) {
			try {
				const [row] = await getDb()
					.select({ data: images.data })
					.from(images)
					.where(eq(images.id, output.image_id))
					.limit(1);
				data = row?.data;
			} catch {
				data = undefined;
			}
		}
		return {
			type: "content",
			value: [
				{
					type: "text",
					text: `Your canvas in ${output.theme}, ${output.width}x${output.height}, exactly as the user sees it:`,
				},
				...(data
					? [
							{
								type: "file" as const,
								mediaType: "image/png",
								data: { type: "data" as const, data },
							},
						]
					: []),
			],
		};
	},
});
