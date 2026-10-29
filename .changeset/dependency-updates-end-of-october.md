---
'strata-stack': patch
---

Dependency updates and a green audit again: Astro 7.4.2 with the matching adapters and integrations (`@astrojs/check` 0.9.12, Cloudflare 14.4.2, MDX 8.1.1, React 7.1.1, Vercel 11.0.16, Node 11.1.9), Better Auth 1.7.13 with the passkey and Drizzle adapter packages and the CLI (kept on one version, which the passkey package's peer dependencies require), Sentry 11.9.0 (both packages), Motion 14.6, lucide-react 1.61, wrangler 4.152, happy-dom 21.0.4, typescript-eslint 8.72 and the Lucide icon set. Advisories published since mid-October made `pnpm audit` fail on `main`: new overrides move `undici` (7.x and 8.x), `toml`, `launch-editor` and `zod` to their patched releases, and happy-dom's own fix arrives with the update. The lockfile was resolved with pnpm's three-day release-age gate, so Better Auth 1.7.14 (under three days old) waits for the next round.
