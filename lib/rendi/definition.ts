import type { Tool } from "ai";

export type AgentDefinition = {
	name: string;
	model: string;
	tools: string[];
	system: string;
};

// Deliberately minimal flat frontmatter parser: strings and string lists only.
// Anything fancier belongs in code, not in the agent file.
export function parseAgentDefinition(source: string): AgentDefinition {
	const match = source.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
	if (!match) {
		throw new Error("Agent definition must start with a --- frontmatter block");
	}
	const [, frontmatter, body] = match;

	const fields: Record<string, string | string[]> = {};
	let currentList: string[] | undefined;

	for (const line of frontmatter.split("\n")) {
		if (!line.trim()) continue;
		const listItem = line.match(/^\s+-\s+(.+)$/);
		if (listItem) {
			if (!currentList) {
				throw new Error(`List item outside a list key: "${line.trim()}"`);
			}
			currentList.push(listItem[1].trim());
			continue;
		}
		const pair = line.match(/^([A-Za-z][A-Za-z0-9_]*):\s*(.*)$/);
		if (!pair) {
			throw new Error(`Unparseable frontmatter line: "${line}"`);
		}
		const [, key, value] = pair;
		if (value === "") {
			currentList = [];
			fields[key] = currentList;
		} else {
			currentList = undefined;
			fields[key] = value.trim();
		}
	}

	const name = fields.name;
	const model = fields.model;
	const tools = fields.tools;
	if (typeof name !== "string" || typeof model !== "string") {
		throw new Error("Agent definition requires string `name` and `model`");
	}
	if (!Array.isArray(tools)) {
		throw new Error("Agent definition requires a `tools` list (may be empty)");
	}

	const system = body.trim();
	if (!system) {
		throw new Error("Agent definition body (the system prompt) is empty");
	}

	return { name, model, tools, system };
}

export function resolveTools<T extends Record<string, Tool>>(
	registry: T,
	names: string[],
): Partial<T> {
	const resolved: Record<string, Tool> = {};
	for (const name of names) {
		const tool = registry[name];
		if (!tool) {
			throw new Error(
				`Agent definition lists unknown tool "${name}". Registered: ${Object.keys(registry).join(", ")}`,
			);
		}
		resolved[name] = tool;
	}
	return resolved as Partial<T>;
}
