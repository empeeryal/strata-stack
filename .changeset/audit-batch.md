---
'strata-stack': minor
---

Hardening from the September audit: the dashboard and the detailed health response decide
access from the database instead of the cookie cache; resending a contact notification takes a
short lease on the message first, so concurrent retries send one email; the contact table gains indexes for
the inbox and overview queries (migration `0002`); the administrator count on the overview
follows the same role rule as authorization; a weekly **Prune data** workflow runs the retention
job; banning asks for an optional reason; posts dated in the future wait for their date; the
search shortcut hint no longer relies on the deprecated platform string alone.
