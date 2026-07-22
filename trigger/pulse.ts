import { schedules, sessions } from "@trigger.dev/sdk";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { pulses } from "@/lib/db/schema";
import { emitSpan } from "@/lib/rendi/harness/telemetry";
import {
	heartbeatMessage,
	newestMessage,
	pulseById,
	turnLooksInFlight,
} from "@/lib/rendi/pulse";

// The beat never does the work. It delivers the standing instruction into
// the conversation's durable session as a [pulse] user message; the agent
// wakes with full history and readback and works the turn itself. The
// session's append-time probe re-triggers an idle or dead run, so beats
// land with every browser closed.
export const rendiPulse = schedules.task({
	id: "rendi-pulse",
	run: async (payload) => {
		const pulse = payload.externalId
			? await pulseById(payload.externalId)
			: undefined;
		if (!pulse) {
			// The row is the source of truth; a schedule without one is an
			// orphan and removes itself.
			if (payload.externalId) {
				await schedules.del(payload.scheduleId).catch(() => {});
			}
			return { beat: "orphaned" as const };
		}

		const span = {
			conversationId: pulse.conversationId,
			turn: 0,
			spanKind: "pulse",
			name: "beat",
			input: pulse.instruction,
			attrs: { pulse_id: pulse.id, cron: pulse.cron },
		};

		const newest = await newestMessage(pulse.conversationId);
		if (turnLooksInFlight(newest)) {
			emitSpan({ ...span, output: { beat: "skipped" } });
			return { beat: "skipped" as const };
		}

		const message = heartbeatMessage(pulse.cron, pulse.instruction);
		await sessions.open(pulse.conversationId).in.send({
			kind: "message",
			payload: {
				chatId: pulse.conversationId,
				trigger: "submit-message",
				messageId: message.id,
				message,
			},
		});
		await getDb()
			.update(pulses)
			.set({ beats: sql`${pulses.beats} + 1`, lastBeatAt: new Date() })
			.where(eq(pulses.id, pulse.id));
		emitSpan({ ...span, output: { beat: "sent", message_id: message.id } });
		return { beat: "sent" as const, messageId: message.id };
	},
});
