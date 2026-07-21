# Trigger Agent Observability

LLM-semantic observability for Trigger.dev chat agents, stored and queried
on ClickHouse. Sessions, turns, generations, tools, tokens, and cost, in
one insert-only table your agent can read with its own hands.

Trigger's dashboard traces runs; this traces what the agent *did*: every
generation with its prompt and TTFT, every tool call with args and result,
every turn with tokens and dollars, parented into one trace tree per turn.

## Quickstart

Provision the sink once (idempotent; creates the database, the spans
table, a write-only user, and seeds model prices):

```console
node --env-file=.env.development.local scripts/telemetry-init.mts
```

Instrument the agent in one place:

```ts
import { chat } from "@trigger.dev/sdk/ai";
import { streamText } from "ai";
import { createAgentObservability } from "@/lib/obs";

const obs = createAgentObservability({ model: () => "claude-opus-4-8" });

export const myChat = chat.agent(
  obs.instrument({
    id: "my-chat",
    tools,
    run: async ({ messages, tools, signal }) => {
      const base = chat.toStreamTextOptions({ tools });
      obs.recordTurnMessages(messages);
      return streamText({
        ...base,
        messages,
        abortSignal: signal,
        ...obs.generationTelemetry(base),
      });
    },
  }),
);
```

That is the whole integration: `instrument()` opens an agent span per
turn, wraps every tool with a span (args, result, duration, errors), and
closes the turn span with tokens, cost, and status; `generationTelemetry`
adds TTFT and one llm span per step with the exact model input.

## Custom span kinds

The base kinds are `agent`, `llm`, and `tool`. Emit your own beside them;
`turnContext()` parents them into the live turn:

```ts
const turn = obs.turnContext();
obs.span({
  conversationId: turn?.conversationId ?? "",
  turn: turn?.turn ?? 0,
  parentSpanId: turn?.spanId,
  spanKind: "query",
  name: "warehouse-read",
  input: sql,
  durationMs: elapsed,
  readRows,
});
```

## Cost

Costs compute at write time from dated rate cards keyed by model id
(`pricing.ts`); `cost_known: 0` marks spans priced by no card, never a
guess. Convention: llm spans carry spend truth, agent spans aggregate
their children, so rollups sum `WHERE span_kind = 'llm'`.

Provider posture: nothing switches on a provider. Models are strings,
usage flows through the AI SDK's neutral shape, and new providers are new
rate-card entries, not code.

## Hosts that need ordering control

`createAgentObservability({ manualTurnEnd: true })` leaves closing the
agent span to you (`obs.endTurnSpan(event)`), for hosts that must order
persistence or follow-up generations around the emit. This repo's chat
task is the reference consumer.

## Reading it back

Grant your read path `SELECT` on the database (the init script creates a
write-only user for the agent side). Every span carries capped `input`
and `output`, so the agent itself can answer questions about its own
behavior with plain SQL.

## OpenTelemetry mapping

Column names are ClickHouse-native; the GenAI semantic-convention mapping
for OTLP export:

| column | gen_ai.* attribute |
| --- | --- |
| model | gen_ai.request.model / gen_ai.response.model |
| input_tokens | gen_ai.usage.input_tokens |
| output_tokens | gen_ai.usage.output_tokens |
| finish_reason | gen_ai.response.finish_reasons |
| span_kind agent | gen_ai.operation.name invoke_agent |
| span_kind llm | gen_ai.operation.name chat |
| span_kind tool | gen_ai.operation.name execute_tool |
| name (tool) | gen_ai.tool.name |
| conversation_id | gen_ai.conversation.id |

All marks and trademarks belong to their owners; this is an independent
integration.
