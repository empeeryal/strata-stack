---
'strata-stack': patch
---

Second audit of the template, with fixes across the stack:

- **Search Console:** the docs breadcrumb trail names an `item` for the section crumb, so the BreadcrumbList structured data validates again.
- **Redirects:** `safeRedirect()` rejects paths that normalise to a protocol-relative URL (`/..//host`), and resolves `..` segments before checking them.
- **Production config:** a placeholder `BETTER_AUTH_SECRET` and a missing public URL are errors; a non-https URL is a warning. `getSiteUrl()` falls back to the platform's production URL.
- **Node behind a proxy:** `security.allowedDomains` is filled in from the site URL (`config/trusted-hosts.ts`), so `X-Forwarded-For` is trusted for the site's own host and rate limiting keys on the visitor, not the proxy.
- **Caching:** `/api/health` and requests with an `Authorization` header are never cached; the guide states plainly that a stored public copy is served to signed-in visitors too. The GitHub stats endpoint memoises the upstream call for two minutes so a cold cache cannot fan out to GitHub.
- **Two-factor:** resetting a user's second factor also forgets their trusted devices; disabling it does the same. Backup-code regeneration is audited, enabling is audited once. The sign-in step explains an expired or used-up attempt (five wrong codes, ten minutes) and a temporary lock.
- **Accounts:** deleting the last active administrator's own account is refused atomically. Signing out other sessions is audited. Names are normalised on sign-up.
- **Newsletter:** confirmation links expire after seven days; the pending, confirmed and unsubscribed transitions are race-safe; a concurrent first-time subscribe keeps one row. Removing a subscriber goes through `removeSubscriber()` and reports when the Resend segment could not be updated. The CSV export neutralises spreadsheet formulas.
- **Throttles** are keyed with an HMAC of `BETTER_AUTH_SECRET` instead of a plain hash.
- **Contact:** control characters are stripped from the notification subject.
- **Accessibility:** ban reasons and delivery errors in the admin tables are read out with their badges; the copy button in the two-factor setup announces its state.
- **Dependencies:** `undici` is overridden to 7.29.1 (GHSA-3wwx-pv8p-q78v, dev-only through miniflare).
- Dead code and duplicates removed (`fnv1a`, `describeError`, `hasAdminRole`, `newsletterLabels`, unused CSS tokens), docs brought in line with the code.
