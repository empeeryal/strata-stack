---
'strata-stack': patch
---

The **Migrate database** workflow also reads the `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`
secrets, logs which of the accepted secret names the job can see, and explains where to add
them when none is found.
