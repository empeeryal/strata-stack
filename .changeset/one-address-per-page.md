---
'strata-stack': patch
---

Search: one address per page. `trailingSlash` is `'never'`, so `/about/` redirects to `/about` instead of serving a second copy (Astro's handler for on-demand routes, the Node server and Vercel's build output for prerendered pages, Cloudflare's `html_handling`; Netlify's CDN still serves both forms and the canonical tag covers it). The search page is `noindex` and out of the sitemap because it has no results without JavaScript. The Dependabot post and the CI guide carry descriptions that name what people search for (pnpm 12, the cooldown, the pnpm audit exceptions).
