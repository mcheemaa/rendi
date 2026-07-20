import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema.ts";

neonConfig.webSocketConstructor = ws;

let db: ReturnType<typeof create> | undefined;

function create() {
	const url =
		process.env.DATABASE_URL_CONNECTION_POOLING ?? process.env.DATABASE_URL;
	if (!url) throw new Error("DATABASE_URL is not set");
	return drizzle(new Pool({ connectionString: url }), { schema });
}

// Lazy so importing modules never touches env at build time.
export function getDb() {
	db ??= create();
	return db;
}

export type Db = ReturnType<typeof getDb>;
