import { describe, expect, it } from "vitest";
import { DATASET_CATALOG, datasetBySlug } from "./datasets.ts";

describe("the dataset catalog", () => {
	it("carries a complete, coherent entry per dataset", () => {
		expect(DATASET_CATALOG.length).toBeGreaterThan(0);
		for (const entry of DATASET_CATALOG) {
			expect(entry.createSql).toContain(
				`CREATE TABLE IF NOT EXISTS default.${entry.table}`,
			);
			expect(entry.insertSql).toContain(`INSERT INTO default.${entry.table}`);
			expect(entry.insertSql).toContain(entry.source);
			expect(entry.estRows).toBeGreaterThan(0);
		}
	});

	it("keeps slugs and tables unique", () => {
		const slugs = DATASET_CATALOG.map((entry) => entry.slug);
		const tables = DATASET_CATALOG.map((entry) => entry.table);
		expect(new Set(slugs).size).toBe(slugs.length);
		expect(new Set(tables).size).toBe(tables.length);
	});

	it("resolves by slug", () => {
		expect(datasetBySlug("hackernews")?.table).toBe("hackernews");
		expect(datasetBySlug("nope")).toBeUndefined();
	});
});
