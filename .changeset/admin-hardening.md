---
'astro-framework-v2': minor
---

Admin hardening from the follow-up audit.

- **Authorization is read from the database** for the admin pages, the admin actions and the
  account export (`getAuthoritativeSession()`), instead of the five-minute session cookie
  cache. Removing the admin role, banning or "sign out everywhere" now applies to the very next
  request.
- **Opening a message no longer mutates on GET.** Marking a message read is an audited POST
  action triggered when a person opens it (or via the new "Mark as read" button); inbox links
  disable prefetching. Previously Astro's viewport prefetch marked every visible message read.
- **Inbox pagination and search**: 25 messages per page with "Showing x–y of n", plus a filter
  by sender name or email. "Mark as unread", read/archive/delivery timestamps on the detail
  page and a confirmation notice after every admin action.
- **Last-admin protection**: the last active administrator cannot be demoted, banned, deleted
  or delete their own account; `pnpm admin:promote --revoke` refuses without `--force`.
- **Audit log**: message actions and their entries are written in one transaction
  (`writeAudit()`); Better Auth user operations stay best-effort and the UI and docs say so.
- `/api/health` returns only `status` and `time` to anonymous callers; administrators and
  requests with `Authorization: Bearer <HEALTH_TOKEN>` get the full checks.
- `CONTACT_MAX_AGE_DAYS` (optional) lets `pnpm db:prune` enforce a maximum age for messages of
  any status; the privacy policy and guide describe the retention rules precisely.
