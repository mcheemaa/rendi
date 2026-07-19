<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="brand/rendi-wordmark-dark.svg">
    <img src="brand/rendi-wordmark.svg" alt="rendi" width="380">
  </picture>
</p>

<p align="center"><strong>Questions become interfaces.</strong></p>

Rendi (from the Italian rendere: to render, and to give back) is a chat agent whose
answers are instruments, not paragraphs: live interfaces that stay connected to your
data, that you operate without invoking the model again, and that the agent reads back
on its next turn so the conversation builds on what you changed.

Built on [ClickHouse](https://clickhouse.com) as the real-time analytical engine and
[Trigger.dev](https://trigger.dev) as the durable agent runtime, during the ClickHouse
and Trigger.dev Virtual Summer Hackathon 2026.

## Status

Early and building in the open. The brand system lives in [brand/](brand/), the
component workshop runs on Storybook (`pnpm storybook`), and accessibility violations
fail the test suite by design.

## Development

```console
pnpm install
pnpm dev                  # Next.js app
pnpm storybook            # component workshop
pnpm test:storybook       # story tests, interactions plus axe accessibility gate
pnpm typecheck && pnpm lint
npx trigger.dev@latest dev --profile rendi   # Trigger.dev tasks, local runner
```

Copy `.env.example` to `.env.development.local` and fill in your keys.

## License

MIT. See [LICENSE](LICENSE).
