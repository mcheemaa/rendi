import type { ModelMessage } from "ai";
import { and, asc, eq, isNull, lte, sql } from "drizzle-orm";
import { getDb } from "../../db/index.ts";
import { instrumentOps, instruments } from "../../db/schema.ts";
import type { InstrumentSpec, Present } from "../instrument.ts";

export type ExecutionRecord = {
	conversationId: string;
	instrumentId: string;
	title: string;
	sqlText: string;
	params: InstrumentSpec["params"];
	present?: Present;
	version: number;
	values: Record<string, string>;
	steer?: { param: string; old: string; new: string };
};

// Every execution keeps the instrument row current with what the user is
// actually seeing; a steer additionally appends to the op log. Runs in
// parallel with the query itself, and its failure never fails an execution.
export async function persistExecution(record: ExecutionRecord): Promise<void> {
	const db = getDb();
	await db
		.insert(instruments)
		.values({
			id: record.instrumentId,
			conversationId: record.conversationId,
			title: record.title,
			sql: record.sqlText,
			params: record.params,
			present: record.present ?? null,
			version: record.version,
			currentValues: record.values,
		})
		.onConflictDoUpdate({
			target: instruments.id,
			set: {
				title: record.title,
				sql: record.sqlText,
				params: record.params,
				present: record.present ?? null,
				version: record.version,
				currentValues: record.values,
				updatedAt: sql`now()`,
			},
		});
	if (record.steer) {
		await db.insert(instrumentOps).values({
			conversationId: record.conversationId,
			instrumentId: record.instrumentId,
			actor: "user",
			param: record.steer.param,
			oldValue: record.steer.old,
			newValue: record.steer.new,
		});
	}
}

// The op id the current turn's block delivered through. A module singleton
// is a safe carrier for the same reason telemetry's activeTurn is: one run
// per worker process, turns sequential within it.
let injected: { chatId: string; through: number } | undefined;

// Property 4's payload: the live state of every instrument (what the user
// sees now) plus each change since the agent's last turn, tagged by actor.
// The transcript already carries the specs; this carries only the state.
export async function instrumentStateBlock(
	chatId: string,
): Promise<string | undefined> {
	const db = getDb();
	const rows = await db
		.select()
		.from(instruments)
		.where(eq(instruments.conversationId, chatId))
		.orderBy(asc(instruments.createdAt));
	if (rows.length === 0) {
		injected = undefined;
		return undefined;
	}
	const unseen = await db
		.select()
		.from(instrumentOps)
		.where(
			and(
				eq(instrumentOps.conversationId, chatId),
				isNull(instrumentOps.seenTurn),
			),
		)
		.orderBy(asc(instrumentOps.id));
	injected = { chatId, through: unseen.at(-1)?.id ?? 0 };

	const payload = {
		instruments: rows.map((row) => ({
			id: row.id,
			title: row.title,
			values: row.currentValues,
			defaults: Object.fromEntries(
				row.params.map((param) => [param.name, param.defaultValue]),
			),
		})),
		...(unseen.length > 0
			? {
					since_your_last_turn: unseen.map((op) => ({
						instrument: op.instrumentId,
						actor: op.actor,
						param: op.param,
						from: op.oldValue,
						to: op.newValue,
						at: op.createdAt.toISOString(),
					})),
				}
			: {}),
	};
	return `<instrument_state>\n${JSON.stringify(payload, null, 1)}\n</instrument_state>`;
}

// The block rides just before the newest user message: the conversation
// prefix stays byte-identical, so injection never busts the prompt cache.
export function withInstrumentState(
	messages: ModelMessage[],
	block: string | undefined,
): ModelMessage[] {
	if (!block || messages.length === 0) return messages;
	return [
		...messages.slice(0, -1),
		{ role: "user", content: block },
		...messages.slice(-1),
	];
}

// At-least-once delivery: only ops the block actually carried are marked,
// so a steer landing mid-turn is delivered next turn, and a crashed turn
// re-delivers rather than losing context.
export async function markOpsSeen(chatId: string, turn: number): Promise<void> {
	const marker = injected;
	injected = undefined;
	if (!marker || marker.chatId !== chatId || marker.through === 0) return;
	await getDb()
		.update(instrumentOps)
		.set({ seenTurn: turn })
		.where(
			and(
				eq(instrumentOps.conversationId, chatId),
				isNull(instrumentOps.seenTurn),
				lte(instrumentOps.id, marker.through),
			),
		);
}
