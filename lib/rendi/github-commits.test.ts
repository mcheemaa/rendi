import { describe, expect, it } from "vitest";
import { applyDetail, mapListCommit, sinceCursor } from "./github-commits.ts";

const listItem = {
	sha: "051f0ce2aaaa",
	parents: [{}, {}],
	commit: {
		author: {
			name: "Shaun Struwig",
			email: "41984034+Blargian@users.noreply.github.com",
			date: "2026-07-22T20:56:32Z",
		},
		message: "Merge pull request #111407\n\nDocs sync from mintlify.",
	},
};

describe("github commit mapping", () => {
	it("maps a list item to a row", () => {
		const row = mapListCommit("ClickHouse", listItem);
		expect(row).toMatchObject({
			repo: "ClickHouse",
			sha: "051f0ce2aaaa",
			author: "Shaun Struwig",
			subject: "Merge pull request #111407",
			body: "Docs sync from mintlify.",
			is_merge: 1,
			additions: 0,
		});
		expect(row.ts).toBe(Math.floor(Date.parse("2026-07-22T20:56:32Z") / 1000));
	});

	it("survives a null author and empty message", () => {
		const row = mapListCommit("rendi", {
			sha: "abc",
			parents: [{}],
			commit: { author: null, message: "" },
		});
		expect(row).toMatchObject({
			author: "",
			author_email: "",
			subject: "",
			body: "",
			ts: 0,
			is_merge: 0,
		});
	});

	it("applies detail stats onto a row", () => {
		const row = applyDetail(mapListCommit("ClickHouse", listItem), {
			stats: { additions: 46, deletions: 27 },
			files: [{}, {}],
		});
		expect(row).toMatchObject({
			additions: 46,
			deletions: 27,
			files_changed: 2,
		});
	});

	it("rewinds the since cursor by an hour", () => {
		expect(sinceCursor(7200)).toBe("1970-01-01T01:00:00.000Z");
		expect(sinceCursor(0)).toBe("1970-01-01T00:00:00.000Z");
	});
});
