import { schedules } from "@trigger.dev/sdk";
import { tool } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { pulses } from "@/lib/db/schema";
import { turnContext } from "@/lib/rendi/harness/telemetry";
import { pulseById, pulsesFor } from "@/lib/rendi/pulse";

const PULSE_TASK = "rendi-pulse";

const opInput = z.object({
	op: z
		.enum(["set", "list", "remove"])
		.describe("set creates or updates, list shows, remove deletes"),
	id: z
		.string()
		.optional()
		.describe("The pulse id: required for remove, optional for set (update)"),
	instruction: z
		.string()
		.optional()
		.describe(
			"set only. The standing instruction each heartbeat delivers to you, written to your future self: what to check, what to improve, where to leave the result",
		),
	cron: z
		.string()
		.optional()
		.describe(
			'set only. Five-field cron, e.g. "0 9 * * *" for daily at 9. Hourly or slower is normal; minutes only when the user explicitly asks.',
		),
	timezone: z
		.string()
		.optional()
		.describe("set only. IANA timezone for the cron; defaults to UTC"),
});

export const pulseOps = tool({
	description:
		"Your own heartbeat schedules for this conversation. set creates or updates a pulse (a Trigger.dev schedule that later delivers the instruction back to you as a [pulse] message; you then do the work in that turn). list shows them; remove deletes one. One conversation can hold several pulses.",
	inputSchema: opInput,
	execute: async (input) => {
		const turn = turnContext();
		if (!turn) throw new Error("pulse-ops outside a turn");
		const db = getDb();

		switch (input.op) {
			case "set": {
				if (!input.instruction || !input.cron) {
					throw new Error("set needs instruction and cron");
				}
				const existing = input.id ? await pulseById(input.id) : undefined;
				if (input.id && !existing) {
					throw new Error(`no pulse ${input.id} to update`);
				}
				const id = existing?.id ?? crypto.randomUUID();
				const schedule = await schedules.create({
					task: PULSE_TASK,
					cron: input.cron,
					timezone: input.timezone,
					externalId: id,
					deduplicationKey: id,
				});
				if (existing) {
					await db
						.update(pulses)
						.set({
							instruction: input.instruction,
							cron: input.cron,
							timezone: input.timezone ?? existing.timezone,
							scheduleId: schedule.id,
							updatedAt: new Date(),
						})
						.where(eq(pulses.id, id));
				} else {
					await db.insert(pulses).values({
						id,
						conversationId: turn.conversationId,
						instruction: input.instruction,
						cron: input.cron,
						timezone: input.timezone ?? "UTC",
						scheduleId: schedule.id,
					});
				}
				return {
					id,
					cron: input.cron,
					timezone: input.timezone ?? "UTC",
					next_run: schedule.nextRun?.toISOString() ?? null,
					updated: Boolean(existing),
				};
			}
			case "list": {
				const rows = await pulsesFor(turn.conversationId);
				return {
					pulses: rows.map((row) => ({
						id: row.id,
						instruction: row.instruction,
						cron: row.cron,
						timezone: row.timezone,
						beats: row.beats,
						last_beat_at: row.lastBeatAt?.toISOString() ?? null,
					})),
				};
			}
			case "remove": {
				if (!input.id) throw new Error("remove needs a pulse id");
				const row = await pulseById(input.id);
				if (!row) throw new Error(`no pulse ${input.id}`);
				if (row.conversationId !== turn.conversationId) {
					throw new Error("pulses belong to their own conversation");
				}
				await schedules.del(row.scheduleId).catch((error) => {
					// A schedule already gone in the dashboard must not strand
					// the row.
					console.warn("[pulse] schedule delete failed", error);
				});
				await db.delete(pulses).where(eq(pulses.id, input.id));
				return { removed: input.id };
			}
		}
	},
});
