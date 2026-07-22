import { task } from "@trigger.dev/sdk";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { datasets } from "@/lib/db/schema";
import { clickhouseAdmin } from "@/lib/rendi/clickhouse";
import { datasetBySlug } from "@/lib/rendi/datasets";
import { emitSpan } from "@/lib/rendi/harness/telemetry";
import { sendSessionText } from "@/lib/rendi/nudge";

const PROGRESS_INTERVAL_MS = 2000;

type IngestPayload = { slug: string; conversationId?: string };

async function tableCount(
	admin: ReturnType<typeof clickhouseAdmin>,
	tableName: string,
): Promise<number> {
	const result = await admin.query({
		query: `SELECT count() AS n FROM default.${tableName}`,
		format: "JSONEachRow",
	});
	const rows = await result.json<{ n: string }>();
	return Number(rows[0]?.n ?? 0);
}

// ClickHouse does the heavy lifting (INSERT ... SELECT FROM s3, millions
// of rows in seconds); this task makes it durable and observable: the
// datasets row carries live progress the card and the agent both read.
// Same-slug runs are serialized (concurrencyKey at trigger time), which
// is what makes truncate-then-insert a safe idempotent attempt: retries
// and repeat requests can never stack rows into the table.
export const rendiIngest = task({
	id: "rendi-ingest",
	queue: { concurrencyLimit: 1 },
	run: async (payload: IngestPayload) => {
		const dataset = datasetBySlug(payload.slug);
		if (!dataset) throw new Error(`unknown dataset ${payload.slug}`);
		const db = getDb();
		const admin = clickhouseAdmin();
		const started = performance.now();

		const finishReady = async (rows: number) => {
			await db
				.insert(datasets)
				.values({
					slug: dataset.slug,
					tableName: dataset.table,
					status: "ready",
					rowsLoaded: rows,
					rowsEstimate: dataset.estRows,
					finishedAt: new Date(),
				})
				.onConflictDoUpdate({
					target: datasets.slug,
					set: {
						status: "ready",
						rowsLoaded: rows,
						error: null,
						finishedAt: new Date(),
						updatedAt: new Date(),
					},
				});
			emitSpan({
				// Ingest outlives the turn that started it, so there is no
				// turn context to attribute; the span stands on its own.
				conversationId: "",
				turn: 0,
				spanKind: "ingest",
				name: dataset.slug,
				status: "ok",
				errorMessage: "",
				durationMs: performance.now() - started,
				resultRows: rows,
				output: { status: "ready", rows },
			});
			if (payload.conversationId) {
				await sendSessionText(
					payload.conversationId,
					`[dataset ${dataset.slug} ready] ${rows.toLocaleString("en-US")} rows live in default.${dataset.table}. Continue what the user asked for.`,
				).catch((error) => console.error("[ingest] nudge failed", error));
			}
			return { status: "ready" as const, rows };
		};

		await admin.command({ query: dataset.createSql });
		// The reader role is granted per table; a table born here gets
		// its grant here, or instruments cannot query it.
		await admin.command({
			query: `GRANT SELECT ON default.${dataset.table} TO rendi_reader`,
		});

		// "Loaded" is the row's status, not a fraction of an estimate: the
		// estimate is advisory (the UK source has no LIMIT), while a ready
		// row plus a non-empty table means a completed load. An empty table
		// under a ready row is a dropped table; reload it.
		const [prior] = await db
			.select()
			.from(datasets)
			.where(eq(datasets.slug, dataset.slug));
		const existing = await tableCount(admin, dataset.table);
		if (prior?.status === "ready" && existing > 0) {
			return finishReady(existing);
		}

		await db
			.insert(datasets)
			.values({
				slug: dataset.slug,
				tableName: dataset.table,
				status: "loading",
				rowsEstimate: dataset.estRows,
				startedAt: new Date(),
			})
			.onConflictDoUpdate({
				target: datasets.slug,
				set: {
					status: "loading",
					error: null,
					rowsLoaded: 0,
					rowsEstimate: dataset.estRows,
					startedAt: new Date(),
					updatedAt: new Date(),
				},
			});

		await admin.command({
			query: `TRUNCATE TABLE default.${dataset.table}`,
		});

		// Guarded on status so a straggling tick that resolves after the
		// ready flip cannot regress the final count.
		const poller = setInterval(() => {
			void tableCount(admin, dataset.table)
				.then((rows) =>
					db
						.update(datasets)
						.set({ rowsLoaded: rows, updatedAt: new Date() })
						.where(
							and(
								eq(datasets.slug, dataset.slug),
								eq(datasets.status, "loading"),
							),
						),
				)
				.catch(() => {});
		}, PROGRESS_INTERVAL_MS);
		try {
			await admin.command({
				query: dataset.insertSql,
				clickhouse_settings: { max_execution_time: 600 },
			});
		} finally {
			clearInterval(poller);
		}

		return finishReady(await tableCount(admin, dataset.table));
	},
	// Terminal only (retries exhausted or the run itself lost), so the
	// agent gets exactly one failed wake and the card cannot spin forever
	// on a row stranded in "loading".
	onFailure: async ({ payload, error }) => {
		const { slug, conversationId } = payload as IngestPayload;
		const dataset = datasetBySlug(slug);
		await getDb()
			.update(datasets)
			.set({
				status: "failed",
				error: String(error).slice(0, 500),
				finishedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(datasets.slug, slug));
		emitSpan({
			conversationId: "",
			turn: 0,
			spanKind: "ingest",
			name: slug,
			status: "error",
			errorMessage: String(error).slice(0, 500),
			durationMs: 0,
			resultRows: 0,
			output: { status: "failed" },
		});
		if (conversationId && dataset) {
			await sendSessionText(
				conversationId,
				`[dataset ${slug} failed] ${String(error).slice(0, 200)}. Tell the user plainly and decide what to do.`,
			).catch(() => {});
		}
	},
});
