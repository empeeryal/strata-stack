---
'strata-stack': minor
---

The audit log is paginated (25 entries per page) and can be filtered by action, by actor or
target and by date range, with the filters kept in the URL. The accessibility suite now also
scans the signed-in dashboard and admin pages and interactive states such as the open mobile
navigation, the search dialog, form errors and the account-deletion form. The new scans found and fixed three contrast problems in the
light theme: the success and danger text colours on tinted alerts and badges, and search
highlights, which Pagefind renders as text in the `--pf-mark` colour rather than as a
background.
