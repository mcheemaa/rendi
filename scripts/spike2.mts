import { AgentChat } from "@trigger.dev/sdk/chat";

const chat = new AgentChat({ agent: "rendi-chat", id: `spike2-${Date.now()}` });

const stream = await chat.sendMessage(
	"Show me daily commit counts for the last 30 days. The table is git.commits with columns ts (DateTime) and sha (String). I want to be able to change the time range.",
);

const sequence: string[] = [];
let deltas = 0;
let instrument: unknown;

for await (const chunk of stream) {
	sequence.push(chunk.type);
	if (chunk.type === "tool-input-delta") deltas++;
	if (chunk.type === "data-instrument") {
		instrument = (chunk as { data: unknown }).data;
	}
	if (chunk.type === "text-delta") {
		process.stdout.write((chunk as { delta: string }).delta);
	}
}

console.log("\n\n=== chunk types in order (deduped runs) ===");
console.log(sequence.filter((t, i) => t !== sequence[i - 1]).join(" -> "));
console.log(`tool-input-delta chunks (the streaming theater): ${deltas}`);
console.log("\n=== data-instrument part ===");
console.log(JSON.stringify(instrument, null, 2));

await chat.close();
