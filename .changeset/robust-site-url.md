---
'astro-framework-v2': patch
---

Builds no longer fail with "Invalid URL" when `SITE_URL` is empty or has no scheme: the canonical URL now falls back to the production URL Vercel or Netlify inject, then to `siteConfig.url` (see `config/site-url.ts`). CI fixes: the `.data` directory is tracked so the e2e database can be created on a fresh checkout, the e2e database is reset before the test server starts, and Lighthouse binds `127.0.0.1` explicitly.
