import { tool } from "ai";
import { z } from "zod";
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
		const base = process.env.RENDI_APP_URL ?? "http://localhost:3000";
		const token = mintRenderToken(turn.conversationId);
		const url = `${base}/internal/canvas/${turn.conversationId}/render?token=${token}&theme=${theme}`;

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
			return {
				looked: true,
				theme,
				width: Math.round(box?.width ?? 0),
				height: Math.round(box?.height ?? 0),
				pngBase64: png.toString("base64"),
			};
		} finally {
			await browser.close();
		}
	},
	// The picture reaches the model as vision input; the raw base64 never
	// prints as text. Shape pinned against the installed ai@7 dist.
	toModelOutput: ({ output }) => ({
		type: "content",
		value: [
			{
				type: "text",
				text: `Your canvas in ${output.theme}, ${output.width}x${output.height}, exactly as the user sees it:`,
			},
			{
				type: "file",
				mediaType: "image/png",
				data: { type: "data", data: output.pngBase64 },
			},
		],
	}),
});
