---
'astro-framework-v2': minor
---

The template now requires pnpm 12 (`packageManager: pnpm@12.4.2`). pnpm's settings moved from
the `pnpm` field in `package.json` to `pnpm-workspace.yaml`: allowed build scripts
(`allowBuilds`), transitive `overrides` and `auditConfig.ignoreGhsas`. The lockfile was
regenerated with pnpm 12. With pnpm 12, Dependabot's release-age gate applies only to the
packages being updated instead of every lockfile entry, so update runs no longer fail while a
recently published package sits in the lockfile.
