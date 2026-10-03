---
'strata-stack': patch
---

The dependency audit ignores two more advisories without a patched release in build-time tooling: `braces` inside the Netlify adapter's function bundler (GHSA-vfj7-8cjw-p6xm) and `http-cache-semantics`, Astro's cache policy for assets fetched at build time (GHSA-ch52-4w7c-c8xp). The CI guide lists them with the reasoning.
