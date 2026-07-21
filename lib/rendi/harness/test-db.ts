import { readdirSync, readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import * as schema from "../../db/schema.ts";

// A fresh in-memory database with every migration replayed in order, so
// pglite tests always run against the exact production schema.
export async function createTestDb() {
	const client = new PGlite();
	const migrations = readdirSync("drizzle")
		.filter((file) => file.endsWith(".sql"))
		.sort();
	for (const file of migrations) {
		const migration = readFileSync(`drizzle/${file}`, "utf8");
		for (const statement of migration.split("--> statement-breakpoint")) {
			await client.exec(statement);
		}
	}
	return drizzle(client, { schema });
}
