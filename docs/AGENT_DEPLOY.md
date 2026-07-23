# Deploying Rendi with an agent

This file is written for an AI agent driving a deploy on a user's behalf. If you are
a human reading this, [DEPLOYMENT.md](DEPLOYMENT.md) covers the same ground in
narrative form; you can also just paste this file to your assistant and say "deploy
this for me."

## Ground rules

- Never echo secret values into chat, logs, or any file other than the env files the
  user owns. Prefer having the user paste secrets directly into dashboards or local
  env files themselves.
- Collect everything in stage 0 before touching anything. Do not interleave asking
  and deploying.
- Verify each stage's check before starting the next. If a check fails, stop and
  diagnose; do not push forward hoping a later stage fixes an earlier one.
- The repository's conventions live in [../AGENTS.md](../AGENTS.md). You are
  deploying, not developing: do not modify code beyond the two files named below
  (`trigger.config.ts` for the project ref, and optionally the email sender).

## Stage 0: collect

Walk the user through gathering these values. Required:

- [ ] `ANTHROPIC_API_KEY`: console.anthropic.com, API keys.
- [ ] ClickHouse: a service at clickhouse.cloud (any region). Note the HTTPS endpoint
      (`CLICKHOUSE_URL`) and the default user's password (`CLICKHOUSE_PASSWORD`).
- [ ] Two passwords the setup will assign, generated fresh (`openssl rand -hex 24`):
      `CLICKHOUSE_READER_PASSWORD` and `CLICKHOUSE_TELEMETRY_PASSWORD`.
- [ ] Neon: a project at neon.tech. Copy the direct connection string
      (`DATABASE_URL`) and the pooled one (`DATABASE_URL_CONNECTION_POOLING`).
- [ ] Trigger.dev: a project at cloud.trigger.dev. Note the project ref (`proj_...`)
      and the environment's secret key (`TRIGGER_SECRET_KEY`).
- [ ] `RENDER_TOKEN_SECRET`: generate with `openssl rand -hex 32`.

Optional, ask which the user wants:

- [ ] `GEMINI_API_KEY` (aistudio.google.com) for image generation.
- [ ] `RESEND_API_KEY` plus a domain verified in Resend for agent-sent email. If
      taken, also update the sender address in `trigger/tools/send-email.ts` to the
      user's domain.
- [ ] `GITHUB_TOKEN`, a zero-scope personal access token, for commit sync rate
      limits and private repositories.
- [ ] `ACCESS_CODES` plus `ACCESS_TOKEN_SECRET` if the deployed instance should sit
      behind an access-code gate.

## Stage 1: local bring-up

```console
pnpm install
cp .env.example .env.development.local   # user fills in the stage 0 values
```

Set the user's project ref in `trigger.config.ts`, then `npx trigger.dev@4.5.4 login`
(the user completes the browser auth).

**Check:** `pnpm typecheck` exits 0 and `pnpm dev` serves the home page on
`localhost:3000`.

## Stage 2: databases

```console
pnpm db:migrate
node --env-file=.env.development.local scripts/seed-clickhouse.mts
node --env-file=.env.development.local scripts/setup-app-views.mts
```

The seed accepts local repo paths as arguments to backfill git history; without
arguments it seeds this checkout's own history as a starter.

**Check:** the seed prints the created roles and tables; `pnpm db:migrate` exits 0;
the views script reports the `app` database.

## Stage 3: first conversation (local proof)

Run `pnpm dev` and `npx trigger.dev@4.5.4 dev --env-file .env.development.local`
together, open `localhost:3000`, and send: "Chart something interesting from the data
you have."

**Check:** an instrument card renders with a live chart, and steering one of its
parameters re-queries without a new model turn (the chart repaints; no new assistant
message appears).

## Stage 4: production

Trigger.dev first:

1. The user fills `.env.trigger.example` values into the project's environment
   variables in the dashboard. `RENDI_APP_URL` is the final public origin.
2. `npx trigger.dev@4.5.4 deploy`

**Check:** the deploy completes and the dashboard shows the new version.

Then Vercel:

1. The user imports the repository at vercel.com (Next.js auto-detected).
2. The user imports the filled `.env.vercel.example` under Settings, Environment
   Variables, and adds their domain.

**Check:** the production URL responds 200 (the gate page counts if configured).

## Stage 5: end-to-end proof

On the production URL, in a new conversation: ask for a small dashboard, watch the
canvas open, steer one chart, then create a share link and open it in a private
window.

**Check:** the shared board renders without cookies and its charts execute live.
Report the production URL, the share link, and anything skipped back to the user.

## When something fails

The traps list at the end of [DEPLOYMENT.md](DEPLOYMENT.md) covers the failures we
actually hit: CLI and SDK version pinning, ClickHouse quoting, Neon cold starts, and
version-pinned sessions. Remember the last one whenever a fresh deploy "does not have"
a tool: durable sessions keep their birth version, so prove changes in a brand-new
conversation.
