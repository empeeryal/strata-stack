---
'strata-stack': patch
---

Dependency audit housekeeping: `fflate` inside the Open Graph image generator is pinned to the
patched 0.7.5, the esbuild advisory reached through drizzle-kit's config loader is recorded as a
build-time exception, and the CI guide lists every audit exception with the reason for it.
