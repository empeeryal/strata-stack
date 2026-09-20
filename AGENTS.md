# Guidance for AI coding agents

This is Strata (package `strata-stack`), an Astro 7.3 website template. The site documents
the template itself. Read this file
before making changes; the full documentation lives in `src/content/docs`.

## Commands

```bash
pnpm install              # Node 24 + pnpm 12 (corepack enable)
pnpm dev                  # dev server (Node)
pnpm check                # astro check – run before finishing any change
pnpm lint && pnpm format  # ESLint 10 flat config, Prettier with astro + tailwind plugins
pnpm test                 # Vitest (unit, Container API, React Testing Library)
pnpm build:node && pnpm test:e2e   # Playwright against the production build
pnpm build:vercel | build:cloudflare | build:netlify   # other targets must keep building
pnpm db:migrate | db:generate | auth:generate           # database and Better Auth schema
```

Environment: copy `.env.example` to `.env`. The local database is `.data/local.db`.

## Architecture in one minute

- `output: 'static'`; only the auth pages (`/login`, `/signup`, `/forgot-password`,
  `/reset-password`), `/dashboard`, `/admin/*`, `/api/*` (auth, account export, health) and
  actions are server rendered (`export const prerender = false`).
- `config/adapter.ts` picks the adapter from `DEPLOY_TARGET` (`node | vercel | cloudflare |
netlify`). Application code must not branch on the platform.
- `src/site.config.ts` holds all branding and navigation.
- Content: `src/content.config.ts` (docs, blog, authors, legal, changelog loader). Docs sections
  come from folder names and `src/lib/docs.ts`.
- Auth: `src/lib/auth.ts` (Better Auth, `better-auth/minimal` + Drizzle adapter), session in
  `Astro.locals` via `src/middleware.ts`. Protect pages inside the page, not by pathname in
  middleware.
- DB: `src/db/client.ts` (libSQL + Drizzle). `src/db/schema/auth.ts` is generated; edit
  `src/db/schema/app.ts` for your own tables, then `pnpm db:generate && pnpm db:migrate`.
- Contact flow: `src/lib/contact.ts` (honeypot, throttle, store-then-notify) behind the action in
  `src/actions/index.ts`. Admin area: `src/pages/admin/*` guarded by `guardAdminPage()`, actions
  under `server.admin` guarded by `await requireAdmin()`. Both read the session from the database
  via `getAuthoritativeSession()` (`src/lib/session.ts`), never from the cookie cache. Audit
  entries: `writeAudit()` inside a transaction for DB-only changes, `recordAudit()` (best-effort)
  for Better Auth operations. Admin pages never change data on GET; use an action.
- Email: `src/lib/email.ts` prints messages only outside production; never log links in production.
- Security: `security.csp` in `astro.config.ts` (hash-based), `config/security-headers.ts`
  (mirrored in `public/_headers`, verified by a unit test).

## Rules that prevent regressions

- **Astro 7 compiler is strict.** Close every non-void tag; no block elements inside `<p>`;
  use `{' '}` between inline elements when a space matters (`compressHTML: 'jsx'`).
- **Reserved files:** `src/fetch.ts` (advanced routing) and `src/middleware.ts`.
- **Zod:** import `z` from `astro/zod` (Zod 4: `z.email()`, not `z.string().email()`).
- **CSP:** never add `<script is:inline>` by hand (not hashed). Use processed `<script>` tags,
  `injectScript('head-inline', …)` from an integration, or list origins in `scriptDirective`.
  Do not add `<ClientRouter />`. CSP is only active in builds, not `astro dev`.
- **Server code** (`src/lib/auth.ts`, `src/lib/env.ts`, `src/lib/email.ts`, `src/db/*`) uses
  `process.env` and relative imports so the Better Auth CLI and Node scripts can load it.
- **Cloudflare:** on-demand routes run in workerd. Keep Node-only packages out of API routes,
  actions and middleware; build-time endpoints may use them (`prerenderEnvironment: 'node'`).
- **TypeScript** stays on 6.x until `@astrojs/check` and `typescript-eslint` support 7.
- **pnpm settings** (`allowBuilds`, `overrides`, `auditConfig`) live in `pnpm-workspace.yaml`;
  pnpm 12 ignores a `pnpm` field in `package.json`.
- **Semantic tokens** (`bg-card`, `text-muted-foreground`) instead of raw palette classes.
- **Tests:** keep `tests/e2e` green, including the CSP and axe specs. Use `waitForIslands(page)`
  before interacting with React islands.
- **Docs:** update `src/content/docs` and add a changeset (`pnpm changeset`) for user-facing changes.

## Verification checklist for any change

1. `pnpm check && pnpm lint && pnpm format:check`
2. `pnpm test`
3. `pnpm build:node && pnpm test:e2e`
4. If config or dependencies changed: `pnpm build:vercel && pnpm build:netlify && pnpm build:cloudflare`
