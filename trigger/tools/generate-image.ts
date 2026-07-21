import { tool } from "ai";
import { eq } from "drizzle-orm";
import { imageSize } from "image-size";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { images } from "@/lib/db/schema";
import { appBase } from "@/lib/rendi/app-url";
import { emitSpan, turnContext } from "@/lib/rendi/harness/telemetry";

const MODEL = "gemini-3.1-flash-image";
const ASPECTS = ["1:1", "4:3", "3:4", "16:9", "9:16"] as const;

// Response shape pinned against a live interactions call (2026-07-21):
// steps[] carries thought and model_output entries; the image arrives as a
// base64 content block. Everything else may drift, so parsing stays loose.
const interactionResponse = z.object({
	status: z.string(),
	steps: z.array(
		z.object({
			type: z.string(),
			content: z
				.array(
					z.object({
						type: z.string(),
						mime_type: z.string().optional(),
						data: z.string().optional(),
						text: z.string().optional(),
					}),
				)
				.optional(),
		}),
	),
	usage: z
		.object({
			total_tokens: z.number(),
			total_input_tokens: z.number().optional(),
			total_output_tokens: z.number().optional(),
		})
		.loose()
		.optional(),
});

const GENERATION_TIMEOUT_MS = 60_000;

export const generateImage = tool({
	description:
		"Create an image from a prompt you author yourself, or refine an earlier one by passing its image_id with a prompt describing the change. Returns a URL for placing the image on the canvas, and the picture itself so you can see what you made. Images usually come out well on the first try; refine at most once unless asked.",
	inputSchema: z.object({
		prompt: z
			.string()
			.min(1)
			.describe(
				"The full art direction: subject, composition, style, palette, lighting, mood. You are the art director; write it rich.",
			),
		aspect_ratio: z
			.enum(ASPECTS)
			.default("4:3")
			.describe("Match the spot the image will occupy"),
		source_image_id: z
			.string()
			.optional()
			.describe(
				"To refine an earlier image: its image_id; the prompt then describes the change",
			),
	}),
	execute: async (
		{ prompt, aspect_ratio, source_image_id },
		{ toolCallId, abortSignal },
	) => {
		const started = performance.now();
		const turn = turnContext();
		if (!turn) throw new Error("generate-image outside a turn");
		if (!process.env.GEMINI_API_KEY) {
			throw new Error("GEMINI_API_KEY is not set");
		}
		const db = getDb();
		const span = {
			conversationId: turn.conversationId,
			turn: turn.turn,
			runId: turn.runId,
			parentSpanId: turn.spanId,
			spanKind: "image" as const,
			name: "generate-image",
			model: MODEL,
			input: prompt,
			toolCallId,
		};

		try {
			let input: unknown = prompt;
			if (source_image_id) {
				const [source] = await db
					.select({ mime: images.mime, data: images.data })
					.from(images)
					.where(eq(images.id, source_image_id))
					.limit(1);
				if (!source) throw new Error(`no image ${source_image_id} to refine`);
				input = [
					{ type: "image", mime_type: source.mime, data: source.data },
					{ type: "text", text: prompt },
				];
			}

			const signals = [AbortSignal.timeout(GENERATION_TIMEOUT_MS)];
			if (abortSignal) signals.push(abortSignal);
			const response = await fetch(
				"https://generativelanguage.googleapis.com/v1beta/interactions",
				{
					method: "POST",
					headers: {
						"x-goog-api-key": process.env.GEMINI_API_KEY,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						model: MODEL,
						input,
						response_format: {
							type: "image",
							aspect_ratio,
							image_size: "1K",
						},
					}),
					signal: AbortSignal.any(signals),
				},
			);
			if (!response.ok) {
				throw new Error(
					`image generation ${response.status}: ${await response.text()}`,
				);
			}
			const interaction = interactionResponse.parse(await response.json());
			const block = interaction.steps
				.flatMap((step) => step.content ?? [])
				.find((content) => content.type === "image" && content.data);
			if (!block?.data || !block.mime_type) {
				throw new Error(`no image in response (status ${interaction.status})`);
			}

			let width: number;
			let height: number;
			try {
				({ width, height } = imageSize(Buffer.from(block.data, "base64")));
			} catch (caught) {
				throw new Error(`unreadable image from model: ${String(caught)}`);
			}
			const id = crypto.randomUUID();
			await db.insert(images).values({
				id,
				conversationId: turn.conversationId,
				prompt,
				mime: block.mime_type,
				data: block.data,
				width,
				height,
			});

			emitSpan({
				...span,
				durationMs: performance.now() - started,
				usage: {
					inputTokens: interaction.usage?.total_input_tokens,
					outputTokens: interaction.usage?.total_output_tokens,
					totalTokens: interaction.usage?.total_tokens,
					inputTokenDetails: {
						noCacheTokens: undefined,
						cacheReadTokens: undefined,
						cacheWriteTokens: undefined,
					},
					outputTokenDetails: {
						textTokens: undefined,
						reasoningTokens: undefined,
					},
				},
				output: {
					imageId: id,
					width,
					height,
					aspect: aspect_ratio,
					refined: Boolean(source_image_id),
				},
			});
			return {
				image_id: id,
				url: `${appBase()}/api/images/${id}`,
				width,
				height,
			};
		} catch (caught) {
			emitSpan({
				...span,
				status: "error",
				errorMessage: String(caught).slice(0, 500),
				durationMs: performance.now() - started,
			});
			throw caught;
		}
	},
	// Bytes re-read here instead of riding the output, so the client only
	// ever streams and persists the URL-shaped fields.
	toModelOutput: async ({ output }) => {
		let row: { mime: string; data: string } | undefined;
		try {
			[row] = await getDb()
				.select({ mime: images.mime, data: images.data })
				.from(images)
				.where(eq(images.id, output.image_id))
				.limit(1);
		} catch {
			// A transient read failure degrades to text; throwing here would
			// drop the model's whole history for the turn.
			row = undefined;
		}
		return {
			type: "content",
			value: [
				{
					type: "text",
					text: `Made ${output.width}x${output.height} image ${output.image_id}, url ${output.url}. It looks like:`,
				},
				...(row
					? [
							{
								type: "file" as const,
								mediaType: row.mime,
								data: { type: "data" as const, data: row.data },
							},
						]
					: []),
			],
		};
	},
});
