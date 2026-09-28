---
'strata-stack': patch
---

Dependency updates from the 28 September Dependabot run, applied together: Astro 7.3.5 with
`@astrojs/react` 7, `@astrojs/mdx` 8.0.2, `@astrojs/cloudflare` 14.3.3 and `@astrojs/vercel`
11.0.11; Better Auth 1.7.6 with its Drizzle adapter, `drizzle-orm` 0.45.3, `drizzle-kit`
0.31.11 and `resend` 6.29; `lucide-react` 1.48, `motion` 13.4.4, `satori` 0.33.5, the Iconify
icon sets, `@types/node`, `wrangler` 4.142, and the tooling (Vitest 5.0.2, ESLint 10.11,
Prettier 3.9.9 with `prettier-plugin-astro` 1.1, `typescript-eslint` 8.70.1). The Vitest config
turns the dev toolbar off so the new Astro no longer annotates Container API output with source
locations, which the component tests compare literally.
