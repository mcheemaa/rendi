# Contributing

Thanks for wanting to make Rendi better. This project started as a hackathon build
(the ClickHouse and Trigger.dev Virtual Summer Hackathon 2026) and is young; issues,
questions, and ideas are as welcome as patches.

## Getting set up

[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) walks the local setup end to end: accounts,
environment, database seeds, and the two dev processes. If you drive with an AI
assistant, [docs/AGENT_DEPLOY.md](docs/AGENT_DEPLOY.md) is written for it.

## House rules

[AGENTS.md](AGENTS.md) is the working constitution: the product law (the Rendi
contract), code standards, UI standards, and voice. It applies to humans as much as
agents. The short version:

- TypeScript strict, Biome clean, comments only where a why needs stating.
- Never hand-roll a UI component the shadcn registry already ships.
- Every component carries a Storybook story; accessibility violations fail the suite.
- Fix root causes, never symptoms.

## Before you open a PR

Run the gates; CI runs exactly these and nothing else:

```console
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Keep PRs small and focused, with clean, human commit messages. UI changes should
include how you verified both themes. If a change touches the agent's behavior,
describe the conversation you proved it with.

## Security

Vulnerabilities go to [SECURITY.md](SECURITY.md)'s private channel, not the issue
tracker.
