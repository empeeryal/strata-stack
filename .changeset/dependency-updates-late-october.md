---
'strata-stack': patch
---

Dependency updates: Astro 7.4.0 with the matching adapters and integrations (`@astrojs/cloudflare` 14.4.0 needs wrangler 4.151, so the two move together), Better Auth 1.7.10 with the passkey and Drizzle adapter packages and the CLI, Sentry 11.8.0 (both packages), React 19.3.1, Motion 14.3, lucide-react 1.58, Resend 6.33, Playwright 1.64.1 with axe-core 4.14, Vitest 5.0.5, ESLint 10.13, typescript-eslint 8.71.2, happy-dom 21.0.3, wrangler 4.151.1 and the Lucide and Simple Icons sets. The lockfile was resolved with pnpm's three-day release-age gate, matching Dependabot's cooldown. axe-core 4.14 adds the "label in name" rule (WCAG 2.5.3), which flagged the header's search trigger: its accessible name is now its visible label, "Search…", with the keyboard-shortcut hint hidden from assistive technology; the icon-only trigger on small screens keeps "Search the site".
