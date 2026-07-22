import { tasks } from "@trigger.dev/sdk";
import { tool } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { datasets } from "@/lib/db/schema";
import { clickhouseReader } from "@/lib/rendi/clickhouse";
import { DATASET_CATALOG, datasetBySlug } from "@/lib/rendi/datasets";
import { turnContext } from "@/lib/rendi/harness/telemetry";
import type { rendiIngest } from "../ingest";

const STALE_LOAD_MS = 45_000;

let reader: ReturnType<typeof clickhouseReader> | undefined;

async function loadedCount(tableName: string): Promise<number | null> {
	reader ??= clickhouseReader();
	try {
		const result = await reader.query({
			query: `SELECT count() AS n FROM default.${tableName}`,
			format: "JSONEachRow",
		});
		const rows = await result.json<{ n: string }>();
		return Number(rows[0]?.n ?? 0);
	} catch {
		return null;
	}
}

export const loadDataset = tool({
	description:
		"Bring public datasets into ClickHouse. catalog lists what can be loaded and what already is, with live row counts; load starts a durable ingestion job (ClickHouse pulls straight from S3, millions of rows in seconds to minutes) and returns immediately. Never poll after load: say what you started, end your turn, and a [dataset ... ready] message wakes you to continue; the user watches live progress on the card meanwhile. status exists only for when the user asks about a load mid-flight.",
	inputSchema: z.object({
		op: z
			.enum(["catalog", "load", "status"])
			.describe("catalog lists, load starts, status checks"),
		slug: z
			.string()
			.optional()
			.describe("Dataset slug from the catalog; required for load and status"),
	}),
	execute: async (input) => {
		const db = getDb();
		switch (input.op) {
			case "catalog": {
				const states = await db.select().from(datasets);
				const entries = await Promise.all(
					DATASET_CATALOG.map(async (entry) => {
						const state = states.find((row) => row.slug === entry.slug);
						const rows = await loadedCount(entry.table);
						return {
							slug: entry.slug,
							title: entry.title,
							description: entry.description,
							table: entry.table,
							est_rows: entry.estRows,
							status:
								state?.status ?? (rows && rows > 0 ? "ready" : "not loaded"),
							rows_loaded: rows ?? state?.rowsLoaded ?? 0,
						};
					}),
				);
				return { datasets: entries };
			}
			case "load": {
				const entry = input.slug ? datasetBySlug(input.slug) : undefined;
				if (!entry) throw new Error(`unknown dataset ${input.slug}`);
				const [state] = await db
					.select()
					.from(datasets)
					.where(eq(datasets.slug, entry.slug));
				// A live ingest bumps its row every two seconds; a loading row
				// gone quiet is a run that died where onFailure cannot fire, so
				// it must stay re-triggerable or the card's retry advice is a
				// lie. The serialized queue makes a spurious re-trigger safe.
				const loadingLive =
					state?.status === "loading" &&
					Date.now() - state.updatedAt.getTime() < STALE_LOAD_MS;
				if (loadingLive && state) {
					return {
						slug: entry.slug,
						status: "loading",
						rows_loaded: state.rowsLoaded,
						est_rows: entry.estRows,
					};
				}
				const existing = await loadedCount(entry.table);
				if (state?.status === "ready" && existing && existing > 0) {
					return { slug: entry.slug, status: "ready", rows_loaded: existing };
				}
				// Same-slug ingests share one serialized queue; a duplicate
				// request lands behind the live load and exits on its ready row.
				await tasks.trigger<typeof rendiIngest>(
					"rendi-ingest",
					{
						slug: entry.slug,
						conversationId: turnContext()?.conversationId,
					},
					{ concurrencyKey: entry.slug },
				);
				return {
					slug: entry.slug,
					status: "loading",
					rows_loaded: 0,
					est_rows: entry.estRows,
					table: entry.table,
				};
			}
			case "status": {
				if (!input.slug) throw new Error("status needs a slug");
				const [state] = await db
					.select()
					.from(datasets)
					.where(eq(datasets.slug, input.slug));
				if (!state) return { slug: input.slug, status: "not loaded" };
				return {
					slug: state.slug,
					status: state.status,
					rows_loaded: state.rowsLoaded,
					est_rows: state.rowsEstimate,
					error: state.error,
				};
			}
		}
	},
});
