---
'astro-framework-v2': minor
---

Repository-wide cleanup.

- **Header shows the signed-in state on prerendered pages.** A small `<account-menu>` element
  fetches the session once per page and swaps the "Sign in" link for the account and admin
  links; server-rendered pages still get it from `Astro.locals`.
- **Admin inbox** can be filtered by notification status (`?delivery=failed`, linked from the
  dashboard); statuses use readable labels (New, Read, Archived; Pending, Sent, Failed, Skipped)
  and share one pagination component with the blog and users pages.
- **Docker image** ships `scripts/migrate.ts` so migrations run with production dependencies
  only (`docker run --rm --env-file .env astro-framework node scripts/migrate.ts`); Drizzle Kit,
  the adapters and the other build-time packages are now dev dependencies.
- **Retention job** moved into `src/lib/retention.ts` with unit tests; `pnpm db:prune` prints
  what it removed.
- **Smaller surface**: unused exports (`requireEnv`, `pruneThrottle`, `POSTS_PER_PAGE`, the
  `EmailNotConfiguredError` class, re-exported auth client helpers) and stale configuration
  (`.npmrc`, `.node-version`, `wrangler types` on every Cloudflare build) are gone; CI installs
  through one composite action and caches the Playwright browser.
- Copy, comments and docs were rewritten to describe the current behaviour without history.
