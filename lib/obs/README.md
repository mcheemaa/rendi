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
import { anthropic } from "@ai-sdk/anthropic";
import { chat } from "@trigger.dev/sdk/ai";
import { streamText } from "ai";
import { createAgentObservability } from "@/lib/obs";

const MODEL = "claude-opus-4-8";
const obs = createAgentObservability({ model: () => MODEL });

export const myChat = chat.agent(
  obs.instrument({
    id: "my-chat",
    tools,
    run: async ({ messages, tools, signal }) => {
      const base = chat.toStreamTextOptions({ tools });
      obs.recordTurnMessages(messages);
      return streamText({
        ...base,
        model: anthropic(MODEL),
        messages,
        abortSignal: signal,
        ...obs.generationTelemetry(base),
        // The AI SDK's default stopWhen caps agents at a single step;
        // end the run only when the model finishes on its own.
        stopWhen: () => false,
      });
    },
  }),
);
```

`instrument()` opens an agent span per turn, wraps every tool with a span
(args, result, duration, errors; per-turn tool resolvers included), and
closes the turn span with tokens, cost, and status, on error paths too;
`generationTelemetry` adds TTFT and one llm span per step with the model
input as the host composed it (per-step prepareStep transforms such as
compaction are not re-captured). This repo's chat task
(`trigger/chat.ts`) is the reference consumer.

## Runtime shape

One turn is active per worker process (Trigger runs one execution per
process at a time; the SDK relies on that). All `createAgentObservability`
instances in a process share one writer and one turn context; when
several configure a writer, the last configuration wins. Spans emitted
outside a turn (action handlers, other processes) carry no parent and
should set `conversationId` explicitly, as this repo's exec route does.

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
guess. The rollup law: agent rows aggregate their in-turn children and
are never summed; spend truth is every non-agent row with
`cost_known = 1`, which covers llm steps, turn-adjacent generations like
titles, and any extension kind that carries usage.

Provider posture: nothing switches on a provider. Models are strings,
usage flows through the AI SDK's neutral shape, and new providers are new
rate-card entries, not code.

## Writer configuration

`createAgentObservability({ writer })` or `configureWriter()` accepts
`{ url, password, username, database }` (defaults `agent_obs_writer` /
`agent_obs`); without explicit configuration the writer reads
`CLICKHOUSE_URL` and `CLICKHOUSE_TELEMETRY_PASSWORD`. A misconfigured
writer disables telemetry with one logged warning; it never fails a turn.

## Hosts that need ordering control

`createAgentObservability({ manualTurnEnd: true })` leaves closing the
agent span to you (`obs.endTurnSpan(event)`), for hosts that must order
persistence or follow-up generations around the emit. Ending the same
turn twice emits once.

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
