# Contributing

Thanks for helping improve the template. This guide covers the workflow; the
[documentation](https://stratastack.dev/docs) explains the architecture.

## Prerequisites

- Node.js 24 (`.nvmrc`) and pnpm 12 (`corepack enable`)
- Git with the Husky pre-commit hook installed automatically by `pnpm install`

## Setup

```bash
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm dev
```

## Before opening a pull request

```bash
pnpm check          # types and Astro diagnostics
pnpm lint           # ESLint
pnpm format:check   # Prettier
pnpm test           # Vitest
pnpm build:node     # production build
pnpm test:e2e       # Playwright against the build
```

CI runs the same commands plus a build for every deploy target (Vercel, Cloudflare, Netlify,
Node). A change must build on all of them.

## Conventions

- **Static first.** Only opt a page out of prerendering when it truly needs a server.
- **Platform-agnostic application code.** Platform differences belong in `config/adapter.ts`,
  `wrangler.jsonc`, `netlify.toml`, `public/_headers` or the Dockerfile, never in components.
- **Semantic tokens.** Use `text-muted-foreground`, `bg-card`, etc., not raw palette colours.
- **Valid HTML.** Astro 7's compiler is strict: close every tag and use `{' '}` for meaningful
  whitespace between inline elements.
- **No hand-written `<script is:inline>`.** Astro does not hash those for the CSP; use processed
  `<script>` tags or an integration's `injectScript('head-inline')`.
- **Tests travel with features.** Add or update Vitest and Playwright coverage for behaviour you
  change, and keep the accessibility and CSP checks green.
- **Docs are part of the change.** Update `src/content/docs` for anything user-facing.

## Changesets

Run `pnpm changeset` for user-facing changes and commit the generated file. Releases are cut by
the release workflow; see the [changelog process](https://stratastack.dev/docs/reference/changelog).

## Commit messages

Use short, imperative subjects (`feat: add newsletter action`, `fix: escape OG titles`). The
release workflow does not depend on the format, but consistency helps reviewers.
