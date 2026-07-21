import { tool } from "ai";
import { eq } from "drizzle-orm";
import { imageSize } from "image-size";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { images } from "@/lib/db/schema";
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
	usage: z.object({ total_tokens: z.number() }).loose().optional(),
});

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
		{ toolCallId },
	) => {
		const started = performance.now();
		const turn = turnContext();
		if (!turn) throw new Error("generate-image outside a turn");
		const db = getDb();

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

		const response = await fetch(
			"https://generativelanguage.googleapis.com/v1beta/interactions",
			{
				method: "POST",
				headers: {
					"x-goog-api-key": process.env.GEMINI_API_KEY ?? "",
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

		const { width, height } = imageSize(Buffer.from(block.data, "base64"));
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

		const base = process.env.RENDI_APP_URL ?? "http://localhost:3000";
		emitSpan({
			conversationId: turn.conversationId,
			turn: turn.turn,
			runId: turn.runId,
			spanKind: "image",
			name: "generate-image",
			model: MODEL,
			input: prompt,
			toolCallId,
			durationMs: performance.now() - started,
			output: {
				imageId: id,
				width,
				height,
				aspect: aspect_ratio,
				refined: Boolean(source_image_id),
				tokens: interaction.usage?.total_tokens ?? 0,
			},
		});
		return {
			image_id: id,
			url: `${base}/api/images/${id}`,
			width,
			height,
		};
	},
	// The picture reaches the model as vision input so it can judge its own
	// work. Bytes are re-read here rather than carried in the output, so the
	// client only ever streams and persists the small URL-shaped fields; the
	// installed ai@7 runtime awaits this hook.
	toModelOutput: async ({ output }) => {
		const [row] = await getDb()
			.select({ mime: images.mime, data: images.data })
			.from(images)
			.where(eq(images.id, output.image_id))
			.limit(1);
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
