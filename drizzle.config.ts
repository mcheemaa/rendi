import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./lib/db/schema.ts",
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: {
		// Direct (non-pooled) URL: migrations need session-level DDL.
		url: process.env.DATABASE_URL ?? "",
	},
});
