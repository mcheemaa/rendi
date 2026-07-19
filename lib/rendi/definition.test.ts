import type { Tool } from "ai";
import { describe, expect, it } from "vitest";
import { parseAgentDefinition, resolveTools } from "./definition.ts";

const valid = `---
name: rendi
model: claude-opus-4-8
tools:
  - render-instrument
---

You are Rendi.
`;

describe("parseAgentDefinition", () => {
	it("parses frontmatter and body", () => {
		expect(parseAgentDefinition(valid)).toEqual({
			name: "rendi",
			model: "claude-opus-4-8",
			tools: ["render-instrument"],
			system: "You are Rendi.",
		});
	});

	it("allows an empty tools list", () => {
		const parsed = parseAgentDefinition(
			"---\nname: a\nmodel: b\ntools:\n---\nBody.",
		);
		expect(parsed.tools).toEqual([]);
	});

	it("rejects a file without a frontmatter block", () => {
		expect(() => parseAgentDefinition("Just a prompt.")).toThrow(/frontmatter/);
	});

	it("rejects an unparseable frontmatter line", () => {
		expect(() => parseAgentDefinition("---\nname rendi\n---\nBody.")).toThrow(
			/Unparseable/,
		);
	});

	it("rejects a list item that follows no list key", () => {
		expect(() => parseAgentDefinition("---\n  - stray\n---\nBody.")).toThrow(
			/outside a list/,
		);
	});

	it("rejects a missing model", () => {
		expect(() =>
			parseAgentDefinition("---\nname: a\ntools:\n---\nBody."),
		).toThrow(/`name` and `model`/);
	});

	it("rejects a missing tools list", () => {
		expect(() =>
			parseAgentDefinition("---\nname: a\nmodel: b\n---\nBody."),
		).toThrow(/`tools` list/);
	});

	it("rejects an empty body", () => {
		expect(() =>
			parseAgentDefinition("---\nname: a\nmodel: b\ntools:\n---\n"),
		).toThrow(/empty/);
	});
});

describe("resolveTools", () => {
	const fake = {} as Tool;
	const registry = { "render-instrument": fake, "exec-query": fake };

	it("resolves exactly the declared names", () => {
		const resolved = resolveTools(registry, ["exec-query"]);
		expect(Object.keys(resolved)).toEqual(["exec-query"]);
	});

	it("throws on an unknown name and says what is registered", () => {
		expect(() => resolveTools(registry, ["does-not-exist"])).toThrow(
			'unknown tool "does-not-exist"',
		);
	});
});
