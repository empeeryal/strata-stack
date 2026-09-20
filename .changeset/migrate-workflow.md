---
'strata-stack': minor
---

Production migrations from GitHub Actions: the new **Migrate database** workflow applies the
migrations in `drizzle/` with `pnpm db:migrate`, on demand or automatically when a merged
change adds one. It reads `DATABASE_URL` and `DATABASE_AUTH_TOKEN` from repository secrets.
The database settings also accept `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`, the names
Turso's Vercel integration sets, so no renaming is needed there.
