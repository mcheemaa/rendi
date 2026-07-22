import { tool } from "ai";
import { and, count, eq, gte } from "drizzle-orm";
import { Resend } from "resend";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { emails } from "@/lib/db/schema";
import { turnContext } from "@/lib/rendi/harness/telemetry";

const FROM = "Rendi <pulse@rendi.help>";
const REPLY_TO = "pulse@rendi.help";
const DAILY_CAP = 50;

let client: Resend | undefined;

function resend(): Resend {
	if (!client) {
		const key = process.env.RESEND_API_KEY;
		if (!key) throw new Error("RESEND_API_KEY is not set");
		client = new Resend(key);
	}
	return client;
}

export const sendEmail = tool({
	description:
		"Send an email from Rendi to an address the user gave in this conversation. You design the whole email yourself: full HTML, inline styles only (email clients run no scripts and load no external CSS), one column near 560px, system font stacks, real hex colors. Include a share link from create-share-link when the answer lives on the board. Never send unprompted, and never to an address the user did not provide.",
	inputSchema: z.object({
		to: z.email().describe("Recipient, exactly as the user gave it"),
		subject: z.string().min(1).max(200),
		html: z.string().min(1).describe("The complete email body as HTML"),
	}),
	execute: async ({ to, subject, html }, { toolCallId }) => {
		const turn = turnContext();
		if (!turn) throw new Error("send-email outside a turn");
		const db = getDb();

		const dayStart = new Date();
		dayStart.setUTCHours(0, 0, 0, 0);
		const [sent] = await db
			.select({ n: count() })
			.from(emails)
			.where(
				and(
					eq(emails.conversationId, turn.conversationId),
					gte(emails.createdAt, dayStart),
				),
			);
		if ((sent?.n ?? 0) >= DAILY_CAP) {
			throw new Error(
				`daily email cap reached (${DAILY_CAP} per conversation); try again tomorrow`,
			);
		}

		const { data, error } = await resend().emails.send(
			{
				from: FROM,
				replyTo: REPLY_TO,
				to: [to],
				subject,
				html,
			},
			// A retried run re-executes the turn with the same tool call id,
			// so the same send can never land twice.
			{ idempotencyKey: `agent-email/${toolCallId}` },
		);
		if (error) throw new Error(`${error.name}: ${error.message}`);

		await db.insert(emails).values({
			conversationId: turn.conversationId,
			to,
			subject,
			resendId: data?.id ?? "",
		});
		return { sent: true, to, subject, resend_id: data?.id ?? "" };
	},
});
