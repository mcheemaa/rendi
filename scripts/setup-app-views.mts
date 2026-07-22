// Exposes the app's own Postgres state inside ClickHouse: an `app`
// database of definer views over postgresql(), one per table, each
// projecting only columns safe for the reader role (no tokens, no
// message payloads, no email addresses, no pulse instructions). The
// agent then joins live product state with datasets and telemetry in
// plain ClickHouse SQL, never seeing Postgres or its credentials.
// Idempotent; re-run whenever the schema grows.
// Run: node --env-file=.env.development.local scripts/setup-app-views.mts
import { clickhouseAdmin } from "../lib/rendi/clickhouse.ts";

const dsn = process.env.DATABASE_URL;
if (!dsn) {
	throw new Error("DATABASE_URL is not set");
}

const url = new URL(dsn);
// ClickHouse holds short-lived connections of its own; the direct Neon
// host is the right target, not the pgbouncer pooler.
const host = `${url.hostname.replace("-pooler", "")}:${url.port || 5432}`;
const database = url.pathname.slice(1);
const user = decodeURIComponent(url.username);
const password = decodeURIComponent(url.password);

const quote = (value: string) => `'${value.replaceAll("'", "\\'")}'`;
const source = (table: string) =>
	`postgresql(${quote(host)}, ${quote(database)}, ${quote(table)}, ${quote(user)}, ${quote(password)})`;

const VIEWS: { name: string; table: string; columns: string[] }[] = [
	{
		name: "conversations",
		table: "conversations",
		columns: ["id", "title", "turns", "created_at", "updated_at"],
	},
	{
		name: "messages",
		table: "messages",
		columns: [
			"conversation_id",
			"id",
			"position",
			"turn",
			"role",
			"created_at",
		],
	},
	{
		name: "instruments",
		table: "instruments",
		columns: [
			"id",
			"conversation_id",
			"title",
			"version",
			"created_at",
			"updated_at",
		],
	},
	{
		name: "instrument_ops",
		table: "instrument_ops",
		columns: [
			"conversation_id",
			"instrument_id",
			"actor",
			"param",
			"old_value",
			"new_value",
			"seen_turn",
			"created_at",
		],
	},
	{
		name: "pulses",
		table: "pulses",
		columns: [
			"id",
			"conversation_id",
			"cron",
			"timezone",
			"beats",
			"last_beat_at",
			"created_at",
			"updated_at",
		],
	},
	{
		name: "emails",
		table: "emails",
		columns: ["conversation_id", "subject", "created_at"],
	},
	{
		name: "datasets",
		table: "datasets",
		columns: [
			"slug",
			"table_name",
			"status",
			"rows_loaded",
			"rows_estimate",
			"error",
			"started_at",
			"finished_at",
			"updated_at",
		],
	},
	{
		name: "canvases",
		table: "canvases",
		columns: [
			"id",
			"conversation_id",
			"title",
			"version",
			"created_at",
			"updated_at",
		],
	},
];

const client = clickhouseAdmin();

await client.command({ query: "CREATE DATABASE IF NOT EXISTS app" });

for (const view of VIEWS) {
	await client.command({
		query: `CREATE OR REPLACE VIEW app.${view.name} DEFINER = CURRENT_USER SQL SECURITY DEFINER AS SELECT ${view.columns.join(", ")} FROM ${source(view.table)}`,
	});
	console.log(
		`app.${view.name} <- ${view.table} (${view.columns.length} columns)`,
	);
}

await client.command({ query: "GRANT SELECT ON app.* TO rendi_reader" });
console.log("granted app.* to rendi_reader");

await client.close();
