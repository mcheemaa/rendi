@AGENTS.md

# Rendi

Rendi (Italian, from rendere: to render, and to give back) turns questions into live
interfaces that remember how you use them. Built for the ClickHouse + Trigger.dev
Virtual Summer Hackathon 2026 (July 17-23), and built as a real product, not a demo.
Theme: Beyond the Wall of Text. The response is the product: if the agent's best answer
is a paragraph, we missed the brief.

## The Rendi contract (product law; every build decision honors it)

1. Every meaningful answer becomes an interface (an instrument), not a prose response.
2. An instrument stays connected to live data. No frozen generated numbers, ever.
3. The user operates it without invoking the model again.
4. Every meaningful interaction becomes durable state the agent receives on its next turn.

## Non-negotiables

- All code is written inside the hackathon build window. Deadline: midnight AoE, July 23, 2026.
- This repo is public at submission under MIT. Everything here is public-grade from the
  first commit: no secrets, no internal paths, nothing we would not publish. Working
  notes, research, and vision documents live in a private workspace outside this repo.
- Credentials live in `.env.development.local` (gitignored); `.env.example` lists names only.
- ClickHouse and Trigger.dev must both be load-bearing. If either could be removed
  without the product collapsing, the design is wrong.
- No shortcuts, no patched symptoms, no demo-ware. Slow is fine; wrong is not.

## Who you are building with

Cheema, plus orchestrated Claude agents doing the building. Calibrate to production
experience with this exact stack:

- Designed and built a production data platform on ClickHouse from scratch: real-time
  CDC replication of 50+ MySQL tables, materialized views, vector search inside
  ClickHouse. Built Oso on it: a chat agent turning plain-English questions into
  ClickHouse SQL over a 3.6M-row materialized view, answering with interactive charts.
- Runs about 20 production Trigger.dev tasks on an HRIS platform.
- Builds agent infrastructure end to end: Phantom, Truffle, mistri, Ghost OS.

Consequences: no beginner explanations, no tutorial-grade solutions, no "good enough
for a hackathon" reasoning. Build like the users are already here.

## How we work

- Think, research, discuss, then build. The deadline compresses scope, never thinking.
- Official docs, skills, and templates are baseline, not gospel. Verify against source;
  where we know better, do better (this repo already corrects stock imports and tokens).
- Nothing is done until verified: tests green, typecheck clean, the real flow exercised
  end to end, UI proven with screenshots. Claims of success require evidence.
- CI runs exactly the local gates and nothing else: `pnpm lint`, `pnpm typecheck`,
  `pnpm test`, `pnpm build`. Green locally must mean green on GitHub.
- Never commit or push without explicit approval.

## Code standards

- TypeScript strict mode, zero errors. No `any`, no `@ts-ignore`, no suppressions.
- Biome enforces the house style; `pnpm lint` must be clean before any commit.
- Comments exist only to explain why, and only where the why is not evident from the
  code. A comment that narrates what a line does must not exist.
- Lean and self-evident: no dead code, no speculative abstraction, no TODO litter.
- Small, focused files. A file past 300 lines is probably doing too much.
- One concern per file, always: system prompts live in their own file, every tool
  lives in its own file under a `tools/` directory, shared schemas live in `lib/`.
  Agent definitions only wire pieces together. No kitchen-sink files, ever.
- `scripts/` holds only load-bearing, public-grade harnesses (today: the spike
  proofs). When a spike graduates into a real test, its script is deleted.
  Exploratory scratch never enters the repo.
- Fix root causes. Never special-case around a bug.

## UI standards

- Design system first. No product UI before tokens, palette, and base components exist.
  The brand system lives in `brand/` (BRAND.md, tokens.css, wordmark, ri mark).
- Components come from shadcn through its CLI (`pnpm dlx shadcn@latest add <name>`),
  base-nova style on Base UI primitives. Hand-creating a component shadcn already
  provides is a violation; customization happens in the installed files and tokens.
- Icons come from Lucide (the project icon library in `components.json`), through
  shadcn conventions. Never hand-roll an icon; the brand marks in `brand/` are the only
  custom vectors in the product.
- Every component ships with a Storybook story beside it (`*.stories.tsx`). The
  Storybook vitest project must pass: interactions and the axe accessibility gate,
  which is set to error and fails the run on violations. Accessibility is a release
  gate, not a cleanup task.
- Pixel-perfect, best in class. The bar is Linear, Vercel, Stripe. Dark and light
  designed together. A Command-K palette is a first-class surface.
- Every UI slice is proven with screenshots in both themes before it is called done.

## Voice

- No em dashes anywhere: code, copy, commits, docs. Use commas, periods, or regular dashes.
- No emojis. No marketing language. Professional, factual, warm.
- Commit messages are clean, human, concise. No co-authored-by lines.

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
npx trigger.dev@latest dev --profile rendi    # Trigger.dev local task runner
npx trigger.dev@latest deploy --profile rendi # deploy tasks
```
