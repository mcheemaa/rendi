<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Working in this repository

Conventions for anyone writing code here, human or agent. Deploying instead of
developing? Humans: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). Agents deploying on a
user's behalf: [docs/AGENT_DEPLOY.md](docs/AGENT_DEPLOY.md).

## The Rendi contract (product law; every change honors it)

1. Every meaningful answer becomes an interface (an instrument), not a prose response.
2. An instrument stays connected to live data. No frozen generated numbers, ever.
3. The user operates it without invoking the model again.
4. Every meaningful interaction becomes durable state the agent receives on its next turn.

Two consequences worth spelling out. The agent's read surface is unrestricted: it may
describe, sample, explore, and analyze anything the reader role can see. Guards live at
the role level (read-only grants, resource caps), never as query whitelists; a limited
agent is a dumb agent. And ClickHouse and Trigger.dev are both load-bearing: if either
could be removed without the product collapsing, the design is wrong.

## Non-negotiables

- Credentials live in `.env.development.local` (gitignored); the `.env*.example` files
  list names only. No secrets in the repo, ever.
- No shortcuts, no patched symptoms, no demo-ware. Fix root causes; never special-case
  around a bug.
- Nothing is done until verified: tests green, typecheck clean, the real flow exercised
  end to end, UI proven in both themes. Claims of success require evidence.

## Code standards

- TypeScript strict mode, zero errors. No `any`, no `@ts-ignore`, no suppressions.
- Biome enforces the house style; `pnpm lint` must be clean before any commit.
- Comments exist only to explain why, and only where the why is not evident from the
  code. A comment that narrates what a line does must not exist.
- Lean and self-evident: no dead code, no speculative abstraction, no TODO litter.
  Small, focused files; a file past 300 lines is probably doing too much.
- One concern per file, always: the system prompt lives in `trigger/rendi/agent.md`,
  every tool lives in its own file under `trigger/tools/`, shared schemas live in
  `lib/`. Agent definitions only wire pieces together. No kitchen-sink files.
- Database changes go through the tooling, never by hand: edit `lib/db/schema.ts`,
  then `pnpm db:generate --name <change>`, then `pnpm db:migrate`. Migration SQL is
  generated output; handwriting or editing it is a defect.
- `scripts/` holds only load-bearing, public-grade harnesses.

## UI standards

- Design system first. The brand system lives in `brand/` (BRAND.md, tokens.css,
  wordmark, the ri mark); those are the only custom vectors in the product.
- HARD REQUIREMENT, never hand-roll a component. Before authoring any UI element,
  check the shadcn registry first. If it exists and is not in the repo, run
  `pnpm dlx shadcn@latest add <name>` and customize the installed file. This includes
  the small things: kbd, spinner, empty states, input groups. Patterns shadcn
  documents rather than ships are adopted from their docs, not reinvented from memory.
- This repo runs shadcn's base-nova style on Base UI primitives: composition happens
  through render props and `string | null` change handlers, not Radix `asChild`. Read
  the installed source under `components/ui/` before composing against it.
- Icons come from Lucide, through shadcn conventions. Never hand-roll an icon.
- Every component ships with a Storybook story beside it (`*.stories.tsx`). The
  Storybook vitest project runs interactions plus the axe accessibility gate, which is
  set to error and fails the run on violations. Accessibility is a release gate, not a
  cleanup task.
- Dark and light designed together. Pixel-perfect, best in class; the bar is Linear,
  Vercel, Stripe.

## Voice

- No em dashes anywhere: code, copy, commits, docs. Use commas, periods, or regular
  dashes. (The framework note at the top of this file is vendor text and exempt.)
- No emojis. No marketing language. Professional, factual, warm.
- UI copy speaks outcomes, never internals.
- Commit messages are clean, human, concise. No co-authored-by lines.

## Gates

CI runs exactly the local gates and nothing else; green locally must mean green on
GitHub. Run all four before any commit:

```console
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Commands

```console
pnpm dev                                      # Next.js app (Turbopack)
pnpm storybook                                # component workshop on :6006
pnpm test:storybook                           # story tests: interactions + axe gate
pnpm test                                     # all vitest projects
pnpm typecheck                                # tsc --noEmit
pnpm lint                                     # biome check .
pnpm format                                   # biome check --write .
pnpm build                                    # production build
pnpm db:generate --name <change>              # drizzle-kit emits the migration SQL
pnpm db:migrate                               # apply pending migrations
npx trigger.dev@4.5.4 dev --env-file .env.development.local   # task runner (pin CLI to SDK version)
npx trigger.dev@4.5.4 deploy                  # deploy tasks
```
