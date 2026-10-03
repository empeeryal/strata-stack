---
'strata-stack': minor
---

Optional error monitoring with Sentry. Setting `PUBLIC_SENTRY_DSN` at build time registers Sentry's Astro integration: the browser SDK on every page (an Astro-processed script, so the hash-based Content Security Policy allows it, and `connect-src` gains the DSN's origin) and, on Node, Vercel and Netlify, the server SDK with its middleware; Cloudflare's workerd gets the browser side only. Errors only: no tracing, no replay, and no personal data, with `dataCollection` off and `scrubEvent()`/`scrubBreadcrumb()` in `src/lib/monitoring.ts` removing the user, cookies, bodies, headers and every query string. Source maps upload when `SENTRY_AUTH_TOKEN` is set. Without the DSN nothing of Sentry is in the build. New monitoring guide; environment, security, deploy and privacy text updated.
