# Deploying Rendi

Rendi is a Next.js app plus a set of Trigger.dev tasks, with ClickHouse as the
analytical engine and Neon Postgres as the transactional store. This guide walks both
tracks, local first, then production, using the exact steps this repository was
deployed with. If an AI assistant is driving the deploy for you, hand it
[AGENT_DEPLOY.md](AGENT_DEPLOY.md) instead; it is the same path written for an agent.

## What you need

| Service | Used for | Required |
| --- | --- | --- |
| [Anthropic API](https://console.anthropic.com) | the agent's model, conversation titles | yes |
| [ClickHouse Cloud](https://clickhouse.cloud) (or any recent ClickHouse) | instruments, datasets, git history, telemetry | yes |
| [Neon](https://neon.tech) (or any Postgres) | conversations, canvases, product state | yes |
| [Trigger.dev](https://trigger.dev) | the durable agent runtime | yes |
| [Google AI Studio](https://aistudio.google.com) | image generation | optional |
| [Resend](https://resend.com) plus a verified domain | agent-sent email | optional |
| GitHub personal access token (zero scopes) | commit sync rate limits, private repos | optional |
| [Vercel](https://vercel.com) | hosting the app | production only |

## 1. Local development

1. **Install.** `pnpm install`. The patch under `patches/` applies automatically; it
   fixes the Trigger.dev playwright build extension for current Playwright releases,
   which matters at deploy time.
2. **Environment.** `cp .env.example .env.development.local` and fill it in. Every
   variable is documented in the matrix below.
3. **Trigger.dev project.** Create a project in the dashboard, put its ref in
   `trigger.config.ts` (`project: "proj_..."`), and authenticate:
   `npx trigger.dev@4.5.4 login`.
4. **Neon schema.** `pnpm db:migrate`.
5. **ClickHouse.**
   `node --env-file=.env.development.local scripts/seed-clickhouse.mts [repo paths...]`
   creates the `git` database, the read-only `rendi_reader` role, and the telemetry
   writer, and backfills commit history from any local clones you pass (churn stats
   stay zero on backfill and arrive later through the GitHub API sync). Then
   `node --env-file=.env.development.local scripts/setup-app-views.mts` exposes the
   product's own Neon state inside ClickHouse as the `app` database.
6. **Run.** `pnpm dev` in one terminal,
   `npx trigger.dev@4.5.4 dev --env-file .env.development.local` in another. The CLI
   version is pinned to the SDK version on purpose; keep them matched.
7. Open `localhost:3000` and ask for a chart.

## 2. Production

### Trigger.dev Cloud (the workers)

1. Fill in `.env.trigger.example` and add the values to the project's environment
   variables in the dashboard.
2. `npx trigger.dev@4.5.4 deploy`.
3. Notes that matter:
   - The playwright extension in `trigger.config.ts` bakes Chromium into the worker
     image so the agent can look at its own boards; the repo's pnpm patch is what
     makes that work with Playwright 1.6x.
   - `RENDI_APP_URL` must be your public app origin. The screenshot and image tools
     persist absolute URLs built from it and fail fast in production without it.
   - Durable chat sessions pin their task version at creation. After deploying
     changes, prove them in a fresh conversation.

### Vercel (the app)

1. Import the repository; Next.js is auto-detected and pnpm comes from
   `packageManager`. No special build settings.
2. Fill in `.env.vercel.example` and import it under Settings, Environment Variables.
3. Add your domain, and make sure the Trigger side's `RENDI_APP_URL` matches it.
4. The access gate is optional: set `ACCESS_TOKEN_SECRET` plus comma-separated
   `ACCESS_CODES` to require a code on first visit (30-day cookie). Leave both unset
   for an open instance.

### After deploy

- If production uses different databases than local, run the two setup scripts once
  against them (same commands, production env file).
- Verify end to end: new conversation, ask for a chart, steer it, watch the canvas
  open, mint a share link and open it in a private window (it must render without
  cookies), and send yourself an email if Resend is configured.

## DoorDash ordering (optional skin)

The agent can browse, build carts, and place real orders through the official
[DoorDash CLI](https://github.com/door-dash/dd-cli), against a personal account,
which is what their terms allow. It is off unless configured; to run without it
entirely, delete the four `doordash-*` lines from `trigger/rendi/agent.md` and
the tools disappear from the agent's hands.

Money is gated structurally, not by prompt: placing an order requires a
six-digit code that is emailed to `RENDI_OWNER_EMAIL` and typed into the order
card, never into the chat. The approval is single-use, expires in fifteen
minutes, dies after five wrong guesses, and is hash-bound to the exact
previewed cart, so any change after the email voids it. Spend caps
(`DD_MAX_ORDER_CENTS`, `DD_MAX_ORDERS_PER_DAY`) are enforced below the agent.
Whoever owns the inbox owns every order, which is the point: you can hand out
gate codes and let strangers drive the agent, and nobody can spend a cent
without you. For that posture set `DD_HIDE_PERSONAL=1` so saved addresses,
payment methods, and order history stay invisible to the agent too.

Setup:

1. Get CLI access from DoorDash (it is waitlisted) and install `dd-cli`.
2. Local: `dd-cli login` opens the browser once and keeps the session in the
   OS keychain. Set `RENDI_OWNER_EMAIL`; Resend must be configured, since the
   codes ride email.
3. Production: workers are headless, so mint a token with `dd-cli export-token`
   on a machine where you are signed in and set it as `DD_CLI_ACCESS_TOKEN` in
   the Trigger.dev environment, alongside the same DoorDash variables. The
   worker image needs the `dd-cli` binary on its PATH; `trigger.config.ts`
   handles that at deploy.

## Environment variables

| Name | Required | Surfaces | What it is |
| --- | --- | --- | --- |
| `ANTHROPIC_API_KEY` | yes | local, Trigger | Model key for the agent and titles. |
| `GEMINI_API_KEY` | optional | local, Trigger | Image generation. Without it the agent simply never makes images. |
| `TRIGGER_SECRET_KEY` | yes | local, Vercel | Per-environment key the app uses to start and resume agent sessions. |
| `DATABASE_URL` | yes | all | Neon direct connection string (migrations, workers). |
| `DATABASE_URL_CONNECTION_POOLING` | yes | local, Vercel | Pooled Neon string for the app's serverless queries. |
| `CLICKHOUSE_URL` | yes | all | HTTPS endpoint of your service. |
| `CLICKHOUSE_USER` | defaults to `default` | local, Trigger | Admin user for seeds and dataset loads. |
| `CLICKHOUSE_PASSWORD` | yes | local, Trigger | Admin password. The app never uses it; user-facing queries ride `rendi_reader`. |
| `CLICKHOUSE_READER_PASSWORD` | yes | all | Password the seed script assigns to `rendi_reader`, the guarded read-only role. |
| `CLICKHOUSE_TELEMETRY_PASSWORD` | yes | local, Trigger (optional on Vercel) | INSERT-only writer for `rendi_telemetry` spans. Add it on Vercel too if you want the app's own instrument executions recorded. |
| `RENDI_MODEL` | defaults to `claude-opus-4-8` | local, Trigger | Agent model id. |
| `RENDER_TOKEN_SECRET` | yes | all | HMAC secret behind render and share tokens. Any long random string: `openssl rand -hex 32`. |
| `RENDI_APP_URL` | yes | all | Public app origin (locally `http://localhost:3000`). |
| `RESEND_API_KEY` | optional | local, Trigger | Agent email. Verify your domain in Resend and point the sender in `trigger/tools/send-email.ts` at it. |
| `GITHUB_TOKEN` | optional | local, Trigger | Zero-scope token for the commit sync: higher rate limits, private repos. |
| `ACCESS_CODES`, `ACCESS_TOKEN_SECRET` | optional | Vercel | The access gate; unset means no gate. |
| `CLICKSTACK_OTLP_URL` | optional | local | Dual-emit telemetry spans to a ClickStack OTLP collector. Unset means off. |
| `RENDI_OWNER_EMAIL` | with DoorDash | local, Trigger | The approval inbox. Every order needs a one-time code from it. |
| `DD_CLI_ACCESS_TOKEN` | with DoorDash | Trigger | Headless auth for deployed workers, from `dd-cli export-token`. Local dev uses `dd-cli login` instead. |
| `DD_MAX_ORDER_CENTS` | defaults to `10000` | local, Trigger | Order ceiling in cents, enforced below the agent. |
| `DD_MAX_ORDERS_PER_DAY` | defaults to `3` | local, Trigger | Daily order budget. |
| `DD_HIDE_PERSONAL` | optional | local, Trigger | `1` hides saved addresses, payment methods, and order history from the agent; for instances strangers can drive. |

## Traps we hit, so you do not have to

- Pin the Trigger CLI to the SDK version (`npx trigger.dev@4.5.4 ...`). A newer CLI
  against an older SDK is undefined behavior.
- ClickHouse string literals are single-quoted. Double quotes are identifiers, and
  the error you get back (a named-collection privilege complaint) will not tell you
  that.
- The first `postgresql()` touch after idle can time out on Neon's cold start. Retry
  once before suspecting configuration.
- Durable chat sessions pin their task version, so a tool added mid-session never
  reaches already-running conversations. New deploys prove themselves in new
  conversations.
- Git backfills from partial clones read commit objects only, so the seed script
  never computes diffs (`--shortstat` would fail on blobless clones). Churn columns
  fill in through the API sync.
- `trigger dev` reloads code on save but never the env file. After editing
  `.env.development.local`, restart the dev worker or the tasks keep the old
  values.
