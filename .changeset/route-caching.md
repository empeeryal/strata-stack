---
'strata-stack': minor
---

Route caching for server-rendered responses. `astro.config.ts` now configures Astro's cache
provider per deploy target (`config/cache.ts`: the platform CDN on Vercel, Netlify and
Cloudflare, the server's memory on Node) and a `routeRules` entry for the first cached route,
`/api/repo-stats`, which returns the repository's star and fork counts for a new badge next to the
GitHub link in the header. The middleware keeps the cache off for anything personal: non-GET
requests, visitors with a Better Auth cookie or session, and the account, admin, auth and
newsletter-token routes (`src/lib/caching.ts`). New guide: docs/guides/caching.
