---
'strata-stack': patch
---

Dependency updates: `@sentry/cloudflare` moves to 11.4.0 so both Sentry packages share one version again (the lockfile had resolved `@sentry/astro` to 11.4.0 while the Cloudflare package stayed pinned at 11.3.0, which bundled two copies of `@sentry/core`), and ESLint moves to 10.12.0.
